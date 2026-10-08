import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Environment, Prisma, StorageChargeUnit, StorageExtraKind, UserRole } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  CreateExtraRateDto,
  CreateRateDto,
  MarkInvoiceDto,
  UpsertDayDto,
} from './dto/storage-control.dto';

const customerSelect = { select: { id: true, code: true, name: true } };
const ENVIRONMENTS: Environment[] = ['FROZEN', 'REFRIGERATED', 'DRY'];

export interface DayComputed {
  customerId: string;
  customer: { id: string; code: string; name: string };
  environment: Environment;
  record: Record<string, unknown> | null; // StorageDay del día (si existe)
  posBalance: number;
  kgBalance: number;
  unit: StorageChargeUnit | null; // del contrato vigente
  rate: number | null;
  storageValue: number; // saldo × tarifa
  kgHandled: number;
  handlingRate: number | null;
  handlingValue: number;
  levelingRate: number | null;
  levelingValue: number;
  totalValue: number;
}

@Injectable()
export class StorageControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  // ---------- Tarifas ----------

  async listRates(customerId: string) {
    const [rates, extras] = await this.prisma.$transaction([
      this.prisma.storageRate.findMany({
        where: { customerId },
        orderBy: [{ environment: 'asc' }, { validFrom: 'desc' }],
      }),
      this.prisma.storageExtraRate.findMany({
        where: { customerId },
        orderBy: [{ kind: 'asc' }, { validFrom: 'desc' }],
      }),
    ]);
    return { rates, extras };
  }

  async createRate(dto: CreateRateDto) {
    return this.prisma.storageRate.create({
      data: {
        customerId: dto.customerId,
        environment: dto.environment,
        unit: dto.unit,
        ratePerDay: dto.ratePerDay,
        validFrom: parseDay(dto.validFrom),
      },
    });
  }

  async deleteRate(id: string) {
    await this.prisma.storageRate.delete({ where: { id } });
    return { ok: true };
  }

  async createExtraRate(dto: CreateExtraRateDto) {
    if (dto.kind === StorageExtraKind.OTRO && !dto.name?.trim()) {
      throw new BadRequestException('El concepto OTRO requiere un nombre');
    }
    return this.prisma.storageExtraRate.create({
      data: {
        customerId: dto.customerId,
        kind: dto.kind,
        name: dto.name?.trim(),
        ratePerKg: dto.ratePerKg,
        validFrom: parseDay(dto.validFrom),
      },
    });
  }

  async deleteExtraRate(id: string) {
    await this.prisma.storageExtraRate.delete({ where: { id } });
    return { ok: true };
  }

  // ---------- Cierre de mes ----------

  async listClosures(year: string) {
    return this.prisma.storageMonthClosure.findMany({
      where: { month: { startsWith: `${year}-` } },
      orderBy: { month: 'asc' },
    });
  }

  async isMonthClosed(month: string): Promise<boolean> {
    const closure = await this.prisma.storageMonthClosure.findUnique({ where: { month } });
    return !!closure;
  }

  async closeMonth(month: string, userId?: string) {
    assertMonth(month);
    await this.prisma.storageMonthClosure.upsert({
      where: { month },
      update: {},
      create: { month, closedById: userId },
    });
    return { month, closed: true };
  }

  /** Reabrir un mes cerrado — solo ADMIN (lo exige el controller). */
  async reopenMonth(month: string) {
    assertMonth(month);
    await this.prisma.storageMonthClosure.deleteMany({ where: { month } });
    return { month, closed: false };
  }

  /** Un mes cerrado solo lo puede modificar un ADMIN. */
  private async assertEditable(date: Date, role?: UserRole) {
    const month = date.toISOString().slice(0, 7);
    if (role !== UserRole.ADMIN && (await this.isMonthClosed(month))) {
      throw new ForbiddenException(
        `El mes ${month} está cerrado — solo un administrador puede modificarlo`,
      );
    }
  }

  // ---------- Registro diario ----------

  async upsertDay(dto: UpsertDayDto, userId?: string, role?: UserRole) {
    const date = parseDay(dto.date);
    await this.assertEditable(date, role);
    const data = {
      posIn: dto.posIn ?? 0,
      posOut: dto.posOut ?? 0,
      kgIn: dto.kgIn ?? 0,
      kgOut: dto.kgOut ?? 0,
      kgHandledOverride: dto.kgHandledOverride ?? null,
      kgLeveled: dto.kgLeveled ?? 0,
      note: dto.note?.trim() || null,
    };
    await this.prisma.storageDay.upsert({
      where: {
        date_customerId_environment: {
          date,
          customerId: dto.customerId,
          environment: dto.environment,
        },
      },
      update: data,
      create: {
        date,
        customerId: dto.customerId,
        environment: dto.environment,
        ...data,
        createdById: userId,
      },
    });
    return this.dayGrid(dto.date);
  }

  async removeDay(id: string, role?: UserRole) {
    const day = await this.prisma.storageDay.findUnique({ where: { id } });
    if (!day) throw new NotFoundException('Registro no encontrado');
    if (day.invoiceRef) throw new BadRequestException('El día ya está facturado — no se puede eliminar');
    await this.assertEditable(day.date, role);
    await this.prisma.storageDay.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Grilla de un día: cada (cliente, ambiente) con historial o registro,
   * con saldos acumulados hasta la fecha y valores según tarifas vigentes.
   */
  async dayGrid(dateStr: string): Promise<{ date: string; rows: DayComputed[] }> {
    const date = parseDay(dateStr);
    const endOfDay = new Date(date.getTime() + 86_400_000);

    // Todos los pares (cliente, ambiente) con algún registro histórico o tarifa.
    const daysAgg = await this.prisma.storageDay.groupBy({
      by: ['customerId', 'environment'],
      where: { date: { lt: endOfDay } },
      _sum: { posIn: true, posOut: true, kgIn: true, kgOut: true },
    });
    const rateCustomers = await this.prisma.storageRate.findMany({
      select: { customerId: true, environment: true },
    });
    const dayRecords = await this.prisma.storageDay.findMany({ where: { date } });
    const customers = await this.prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    });

    const customerById = new Map(customers.map((c) => [c.id, c]));
    const pairs = new Map<string, { customerId: string; environment: Environment }>();
    for (const d of daysAgg) pairs.set(`${d.customerId}|${d.environment}`, d);
    for (const r of rateCustomers) pairs.set(`${r.customerId}|${r.environment}`, r);

    const recordByPair = new Map(dayRecords.map((r) => [`${r.customerId}|${r.environment}`, r]));
    const sumsByPair = new Map(daysAgg.map((d) => [`${d.customerId}|${d.environment}`, d._sum]));

    const rows: DayComputed[] = [];
    for (const { customerId, environment } of pairs.values()) {
      const customer = customerById.get(customerId);
      if (!customer) continue;
      const sums = sumsByPair.get(`${customerId}|${environment}`);
      const record = recordByPair.get(`${customerId}|${environment}`) ?? null;
      const posBalance = (sums?.posIn ?? 0) - (sums?.posOut ?? 0);
      const kgBalance = num(sums?.kgIn) - num(sums?.kgOut);

      const rate = await this.effectiveRate(customerId, environment, date);
      const handlingRate = await this.effectiveExtra(customerId, StorageExtraKind.CARGUE_DESCARGUE, date);
      const levelingRate = await this.effectiveExtra(customerId, StorageExtraKind.NIVELACION, date);

      const kgHandled = record
        ? record.kgHandledOverride != null
          ? num(record.kgHandledOverride)
          : num(record.kgIn) + num(record.kgOut)
        : 0;
      const kgLeveled = record ? num(record.kgLeveled) : 0;

      const storageValue = rate
        ? round2((rate.unit === StorageChargeUnit.KG_DAY ? kgBalance : posBalance) * num(rate.ratePerDay))
        : 0;
      const handlingValue = handlingRate ? round2(kgHandled * handlingRate) : 0;
      const levelingValue = levelingRate ? round2(kgLeveled * levelingRate) : 0;

      rows.push({
        customerId,
        customer,
        environment,
        record: record as Record<string, unknown> | null,
        posBalance,
        kgBalance: round2(kgBalance),
        unit: rate?.unit ?? null,
        rate: rate ? num(rate.ratePerDay) : null,
        storageValue: Math.max(storageValue, 0),
        kgHandled: round2(kgHandled),
        handlingRate,
        handlingValue,
        levelingRate,
        levelingValue,
        totalValue: round2(Math.max(storageValue, 0) + handlingValue + levelingValue),
      });
    }

    rows.sort((a, b) => a.customer.name.localeCompare(b.customer.name) || a.environment.localeCompare(b.environment));
    return { date: dateStr, rows };
  }

  // ---------- Ocupación ----------

  /** Ocupación por bodega para un rango de días: saldo de posiciones vs capacidad. */
  async occupancy(fromStr: string, toStr: string) {
    const from = parseDay(fromStr);
    const to = parseDay(toStr);
    if (to < from) throw new BadRequestException('Rango inválido');
    const days = Math.min(Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1, 62);

    const capacity: Record<Environment, number> = {
      DRY: await this.settings.getNumber('capacity.dry'),
      REFRIGERATED: await this.settings.getNumber('capacity.refrigerated'),
      FROZEN: await this.settings.getNumber('capacity.frozen'),
    };

    // Saldo inicial (antes del rango) + movimientos del rango, por ambiente.
    const before = await this.prisma.storageDay.groupBy({
      by: ['environment'],
      where: { date: { lt: from } },
      _sum: { posIn: true, posOut: true },
    });
    const inRange = await this.prisma.storageDay.findMany({
      where: { date: { gte: from, lt: new Date(to.getTime() + 86_400_000) } },
      select: { date: true, environment: true, posIn: true, posOut: true },
    });

    const running: Record<Environment, number> = { DRY: 0, REFRIGERATED: 0, FROZEN: 0 };
    for (const b of before) running[b.environment] = (b._sum?.posIn ?? 0) - (b._sum?.posOut ?? 0);

    const byDay = new Map<string, Record<Environment, { in: number; out: number }>>();
    for (const r of inRange) {
      const key = r.date.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? {
        DRY: { in: 0, out: 0 },
        REFRIGERATED: { in: 0, out: 0 },
        FROZEN: { in: 0, out: 0 },
      };
      entry[r.environment].in += r.posIn;
      entry[r.environment].out += r.posOut;
      byDay.set(key, entry);
    }

    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(from.getTime() + i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      const moves = byDay.get(key);
      const row: Record<string, unknown> = { date: key };
      for (const env of ENVIRONMENTS) {
        if (moves) running[env] += moves[env].in - moves[env].out;
        row[env] = {
          occupied: running[env],
          capacity: capacity[env],
          available: capacity[env] - running[env],
          pct: capacity[env] > 0 ? round2((running[env] / capacity[env]) * 100) : null,
        };
      }
      result.push(row);
    }
    return { capacity, days: result };
  }

  // ---------- Mensual por cliente ----------

  async monthly(customerId: string, monthStr: string) {
    const from = parseDay(`${monthStr}-01`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, ...customerSelect });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const days: { date: string; rows: DayComputed[] }[] = [];
    const totals = { storage: 0, handling: 0, leveling: 0, total: 0 };
    const daysInMonth = to.getUTCDate();

    // Saldos acumulados previos al mes por ambiente
    const before = await this.prisma.storageDay.groupBy({
      by: ['environment'],
      where: { customerId, date: { lt: from } },
      _sum: { posIn: true, posOut: true, kgIn: true, kgOut: true },
    });
    const posBal: Record<string, number> = {};
    const kgBal: Record<string, number> = {};
    for (const env of ENVIRONMENTS) {
      const b = before.find((x) => x.environment === env);
      posBal[env] = (b?._sum?.posIn ?? 0) - (b?._sum?.posOut ?? 0);
      kgBal[env] = num(b?._sum?.kgIn) - num(b?._sum?.kgOut);
    }

    const records = await this.prisma.storageDay.findMany({
      where: { customerId, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
    const recByKey = new Map(records.map((r) => [`${r.date.toISOString().slice(0, 10)}|${r.environment}`, r]));

    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), i));
      const key = d.toISOString().slice(0, 10);
      const rows: DayComputed[] = [];
      for (const env of ENVIRONMENTS) {
        const rec = recByKey.get(`${key}|${env}`) ?? null;
        if (rec) {
          posBal[env] += rec.posIn - rec.posOut;
          kgBal[env] += num(rec.kgIn) - num(rec.kgOut);
        }
        const rate = await this.effectiveRate(customerId, env, d);
        if (!rate && !rec && posBal[env] === 0 && kgBal[env] === 0) continue;
        const handlingRate = await this.effectiveExtra(customerId, StorageExtraKind.CARGUE_DESCARGUE, d);
        const levelingRate = await this.effectiveExtra(customerId, StorageExtraKind.NIVELACION, d);
        const kgHandled = rec
          ? rec.kgHandledOverride != null
            ? num(rec.kgHandledOverride)
            : num(rec.kgIn) + num(rec.kgOut)
          : 0;
        const storageValue = rate
          ? round2(Math.max(rate.unit === StorageChargeUnit.KG_DAY ? kgBal[env] : posBal[env], 0) * num(rate.ratePerDay))
          : 0;
        const handlingValue = handlingRate ? round2(kgHandled * handlingRate) : 0;
        const levelingValue = levelingRate && rec ? round2(num(rec.kgLeveled) * levelingRate) : 0;
        rows.push({
          customerId,
          customer,
          environment: env,
          record: rec as Record<string, unknown> | null,
          posBalance: posBal[env],
          kgBalance: round2(kgBal[env]),
          unit: rate?.unit ?? null,
          rate: rate ? num(rate.ratePerDay) : null,
          storageValue,
          kgHandled: round2(kgHandled),
          handlingRate,
          handlingValue,
          levelingRate,
          levelingValue,
          totalValue: round2(storageValue + handlingValue + levelingValue),
        });
        totals.storage = round2(totals.storage + storageValue);
        totals.handling = round2(totals.handling + handlingValue);
        totals.leveling = round2(totals.leveling + levelingValue);
      }
      days.push({ date: key, rows });
    }
    totals.total = round2(totals.storage + totals.handling + totals.leveling);
    const closed = await this.isMonthClosed(monthStr);
    const invoiceRefs = [...new Set(records.map((r) => r.invoiceRef).filter(Boolean))] as string[];
    return { customer, month: monthStr, days, totals, closed, invoiceRefs };
  }

  // ---------- Pre-factura (todos los clientes del mes) ----------

  async billingSummary(monthStr: string) {
    assertMonth(monthStr);
    const from = parseDay(`${monthStr}-01`);
    const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0));

    // Clientes con actividad en el mes o con saldo arrastrado (registros previos) o tarifas.
    const withDays = await this.prisma.storageDay.findMany({
      where: { date: { lte: to } },
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const withRates = await this.prisma.storageRate.findMany({
      select: { customerId: true },
      distinct: ['customerId'],
    });
    const customerIds = [...new Set([...withDays, ...withRates].map((x) => x.customerId))];

    const rows = [];
    for (const customerId of customerIds) {
      const report = await this.monthly(customerId, monthStr);
      if (report.totals.total === 0 && report.days.every((d) => d.rows.length === 0)) continue;
      rows.push({
        customer: report.customer,
        totals: report.totals,
        invoiceRefs: report.invoiceRefs,
      });
    }
    rows.sort((a, b) => b.totals.total - a.totals.total);

    const grand = rows.reduce(
      (acc, r) => ({
        storage: round2(acc.storage + r.totals.storage),
        handling: round2(acc.handling + r.totals.handling),
        leveling: round2(acc.leveling + r.totals.leveling),
        total: round2(acc.total + r.totals.total),
      }),
      { storage: 0, handling: 0, leveling: 0, total: 0 },
    );

    return { month: monthStr, closed: await this.isMonthClosed(monthStr), rows, grand };
  }

  // ---------- Exports a Excel ----------

  async exportMonthly(customerId: string, monthStr: string): Promise<{ filename: string; buffer: Buffer }> {
    const report = await this.monthly(customerId, monthStr);
    const wb = XLSX.utils.book_new();

    const resumen = XLSX.utils.aoa_to_sheet([
      ['ALL-LOGISTICS — CONTROL DE ALMACENAJE'],
      [],
      ['Cliente', report.customer.name],
      ['Mes', report.month],
      ['Estado', report.closed ? 'MES CERRADO' : 'Abierto'],
      ['Factura(s)', report.invoiceRefs.join(', ') || '—'],
      [],
      ['Concepto', 'Valor'],
      ['Almacenaje', report.totals.storage],
      ['Cargue / descargue', report.totals.handling],
      ['Nivelación de temperatura', report.totals.leveling],
      ['TOTAL MES', report.totals.total],
    ]);
    resumen['!cols'] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');

    const header = [
      'Fecha',
      'Bodega',
      'Pos. entra',
      'Pos. sale',
      'Saldo pos.',
      'Kg entra',
      'Kg sale',
      'Saldo kg',
      'Unidad cobro',
      'Tarifa',
      'Almacenaje $',
      'Kg manipulados',
      'Cargue $',
      'Kg nivelados',
      'Nivelación $',
      'Total día $',
      'No. factura',
    ];
    const detail: (string | number)[][] = [header];
    for (const day of report.days) {
      for (const r of day.rows) {
        const rec = r.record as { posIn?: number; posOut?: number; kgIn?: string; kgOut?: string; kgLeveled?: string; invoiceRef?: string } | null;
        detail.push([
          day.date,
          ENV_ES[r.environment],
          rec?.posIn ?? 0,
          rec?.posOut ?? 0,
          r.posBalance,
          Number(rec?.kgIn ?? 0),
          Number(rec?.kgOut ?? 0),
          r.kgBalance,
          r.unit === 'KG_DAY' ? '$/kg/día' : r.unit === 'POSITION_DAY' ? '$/posición/día' : '—',
          r.rate ?? 0,
          r.storageValue,
          r.kgHandled,
          r.handlingValue,
          Number(rec?.kgLeveled ?? 0),
          r.levelingValue,
          r.totalValue,
          rec?.invoiceRef ?? '',
        ]);
      }
    }
    const detalle = XLSX.utils.aoa_to_sheet(detail);
    detalle['!cols'] = header.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, detalle, 'Detalle diario');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const safeName = report.customer.name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
    return { filename: `almacenaje-${safeName}-${monthStr}.xlsx`, buffer };
  }

  async exportBilling(monthStr: string): Promise<{ filename: string; buffer: Buffer }> {
    const summary = await this.billingSummary(monthStr);
    const rows: (string | number)[][] = [
      ['ALL-LOGISTICS — PRE-FACTURA DE ALMACENAJE', '', '', '', '', ''],
      ['Mes', summary.month, summary.closed ? 'MES CERRADO' : 'Abierto', '', '', ''],
      [],
      ['Cliente', 'Almacenaje $', 'Cargue/descargue $', 'Nivelación $', 'TOTAL $', 'Factura(s)'],
      ...summary.rows.map((r) => [
        r.customer.name,
        r.totals.storage,
        r.totals.handling,
        r.totals.leveling,
        r.totals.total,
        r.invoiceRefs.join(', '),
      ]),
      [],
      ['TOTAL', summary.grand.storage, summary.grand.handling, summary.grand.leveling, summary.grand.total, ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pre-factura');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return { filename: `prefactura-almacenaje-${monthStr}.xlsx`, buffer };
  }

  /** Marca un rango de días del cliente con el número de factura. */
  async markInvoice(dto: MarkInvoiceDto) {
    const from = parseDay(dto.from);
    const to = parseDay(dto.to);
    const result = await this.prisma.storageDay.updateMany({
      where: { customerId: dto.customerId, date: { gte: from, lte: to } },
      data: { invoiceRef: dto.invoiceRef?.trim() || null },
    });
    return { updated: result.count };
  }

  // ---------- Tarifa vigente ----------

  private async effectiveRate(customerId: string, environment: Environment, date: Date) {
    return this.prisma.storageRate.findFirst({
      where: { customerId, environment, validFrom: { lte: date } },
      orderBy: { validFrom: 'desc' },
    });
  }

  private async effectiveExtra(customerId: string, kind: StorageExtraKind, date: Date): Promise<number | null> {
    const rate = await this.prisma.storageExtraRate.findFirst({
      where: { customerId, kind, validFrom: { lte: date } },
      orderBy: { validFrom: 'desc' },
    });
    return rate ? num(rate.ratePerKg) : null;
  }
}

const ENV_ES: Record<Environment, string> = {
  FROZEN: 'Congelado',
  REFRIGERATED: 'Refrigerado',
  DRY: 'Seco',
};

function assertMonth(s: string) {
  if (!/^\d{4}-\d{2}$/.test(s)) throw new BadRequestException(`Mes inválido: ${s} (se espera AAAA-MM)`);
}

function parseDay(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) throw new BadRequestException(`Fecha inválida: ${s} (se espera AAAA-MM-DD)`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
