import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Environment, Prisma, StorageChargeUnit, StorageExtraKind } from '@prisma/client';
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

  // ---------- Registro diario ----------

  async upsertDay(dto: UpsertDayDto, userId?: string) {
    const date = parseDay(dto.date);
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

  async removeDay(id: string) {
    const day = await this.prisma.storageDay.findUnique({ where: { id } });
    if (!day) throw new NotFoundException('Registro no encontrado');
    if (day.invoiceRef) throw new BadRequestException('El día ya está facturado — no se puede eliminar');
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
    return { customer, month: monthStr, days, totals };
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
