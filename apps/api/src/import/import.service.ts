import { BadRequestException, Injectable } from '@nestjs/common';
import { Customer, CustomerServiceType, Environment, MeasureType } from '@prisma/client';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { ImportReport, ImportRowError, ImportType, TEMPLATES } from './import.types';

@Injectable()
export class ImportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Genera la plantilla XLSX del tipo pedido (encabezados + fila de ejemplo). */
  buildTemplate(type: ImportType): { filename: string; buffer: Buffer } {
    const def = TEMPLATES[type];
    const ws = XLSX.utils.aoa_to_sheet([def.headers, def.example]);
    ws['!cols'] = def.headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    const notes = XLSX.utils.aoa_to_sheet([
      ['Instrucciones'],
      ['1. No cambies ni muevas los encabezados de la hoja "Datos".'],
      ['2. La fila 2 es un EJEMPLO — bórrala o reemplázala con datos reales.'],
      ['3. Las columnas marcadas con * son obligatorias.'],
      ['4. Si el registro ya existe (por código/NIT), se ACTUALIZA en vez de duplicarse.'],
      ['5. Sube el archivo en Tower → Más → Importación masiva. Primero corre el simulacro.'],
    ]);
    notes['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, notes, 'Instrucciones');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return { filename: `plantilla-${def.name}-tower.xlsx`, buffer };
  }

  /** Importa (o simula) el archivo del tipo dado. */
  async import(type: ImportType, file: Express.Multer.File, dryRun: boolean): Promise<ImportReport> {
    if (!file?.buffer?.length) throw new BadRequestException('Archivo vacío o no recibido');
    let rows: Record<string, unknown>[];
    try {
      const wb = XLSX.read(file.buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    } catch {
      throw new BadRequestException('No se pudo leer el archivo — ¿es un .xlsx válido?');
    }

    switch (type) {
      case 'customers':
        return this.importCustomers(rows, dryRun);
      case 'products':
        return this.importProducts(rows, dryRun);
      case 'sites':
        return this.importSites(rows, dryRun);
    }
  }

  // ---------- Clientes ----------

  private async importCustomers(rows: Record<string, unknown>[], dryRun: boolean): Promise<ImportReport> {
    const report = newReport(dryRun, rows.length);
    let codeSeq = await this.nextCustomerCodeNumber();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 encabezado, +1 base 1
      const r = normalizeKeys(rows[i]);
      const name = str(r, 'razón social') || str(r, 'razon social');
      if (!name) {
        report.errors.push({ row: rowNum, field: 'Razón social', message: 'Obligatoria' });
        continue;
      }
      if (isExampleRow(name)) {
        report.skipped++;
        continue;
      }
      const taxId = str(r, 'nit');
      const code = str(r, 'código') || str(r, 'codigo');
      const serviceRaw = (str(r, 'tipo de servicio') || 'INVENTARIO').toUpperCase();
      const serviceType = parseServiceType(serviceRaw);
      if (!serviceType) {
        report.errors.push({
          row: rowNum,
          field: 'Tipo de servicio',
          message: `"${serviceRaw}" no es válido (INVENTARIO / CROSS-DOCK / AMBOS)`,
        });
        continue;
      }

      const data = {
        name,
        taxId: taxId || undefined,
        addressLine: str(r, 'dirección') || str(r, 'direccion') || undefined,
        contactName: str(r, 'contacto') || undefined,
        phone: str(r, 'teléfono') || str(r, 'telefono') || undefined,
        email: str(r, 'correo') || undefined,
        serviceType,
        notes: str(r, 'notas') || undefined,
      };

      // Clave natural: código si viene, luego NIT, luego razón social exacta
      const existing =
        (code && (await this.prisma.customer.findUnique({ where: { code } }))) ||
        (taxId && (await this.prisma.customer.findFirst({ where: { taxId } }))) ||
        (await this.prisma.customer.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } }));

      try {
        if (existing) {
          if (!dryRun) {
            await this.prisma.customer.update({ where: { id: existing.id }, data });
          }
          report.updated++;
        } else {
          if (!dryRun) {
            await this.prisma.customer.create({
              data: { ...data, code: code || `CL-${String(codeSeq).padStart(4, '0')}` },
            });
          }
          if (!code) codeSeq++;
          report.created++;
        }
      } catch (e) {
        report.errors.push({ row: rowNum, message: errMsg(e) });
      }
    }
    return report;
  }

  // ---------- Items ----------

  private async importProducts(rows: Record<string, unknown>[], dryRun: boolean): Promise<ImportReport> {
    const report = newReport(dryRun, rows.length);
    const customerCache = new Map<string, Customer | null>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const r = normalizeKeys(rows[i]);
      const customerRef = str(r, 'cliente');
      const code = str(r, 'código del item') || str(r, 'codigo del item');
      const name = str(r, 'nombre');
      if (!customerRef || !code || !name) {
        report.errors.push({ row: rowNum, message: 'Cliente, código del item y nombre son obligatorios' });
        continue;
      }

      const customer = await this.findCustomer(customerRef, customerCache);
      if (!customer) {
        report.errors.push({ row: rowNum, field: 'Cliente', message: `No existe el cliente "${customerRef}" — impórtalo primero` });
        continue;
      }

      const measureRaw = str(r, 'manejo').toUpperCase();
      const measure = measureRaw === 'KG' ? MeasureType.KG : measureRaw === 'UND' ? MeasureType.UND : null;
      if (!measure) {
        report.errors.push({ row: rowNum, field: 'Manejo', message: `"${measureRaw}" no es válido (KG / UND)` });
        continue;
      }

      const envRaw = str(r, 'bodega').toUpperCase();
      const environment = parseEnvironment(envRaw);
      if (!environment) {
        report.errors.push({
          row: rowNum,
          field: 'Bodega',
          message: `"${envRaw}" no es válida (CONGELADO / REFRIGERADO / SECO)`,
        });
        continue;
      }

      const shelfRaw = str(r, 'vida útil') || str(r, 'vida util');
      const shelfLifeDays = shelfRaw ? parseInt(shelfRaw, 10) : undefined;
      if (shelfRaw && (!Number.isInteger(shelfLifeDays) || shelfLifeDays! <= 0)) {
        report.errors.push({ row: rowNum, field: 'Vida útil', message: `"${shelfRaw}" no es un número de días válido` });
        continue;
      }

      const data = {
        name,
        barcode: str(r, 'código de barras') || str(r, 'codigo de barras') || undefined,
        measure,
        unit: measure === MeasureType.KG ? 'KG' : str(r, 'unidad visible') || 'UND',
        environment,
        shelfLifeDays,
        notes: str(r, 'notas') || undefined,
      };

      try {
        const existing = await this.prisma.product.findUnique({
          where: { customerId_code: { customerId: customer.id, code } },
        });
        if (existing) {
          if (!dryRun) await this.prisma.product.update({ where: { id: existing.id }, data });
          report.updated++;
        } else {
          if (!dryRun) await this.prisma.product.create({ data: { ...data, customerId: customer.id, code } });
          report.created++;
        }
      } catch (e) {
        report.errors.push({ row: rowNum, message: errMsg(e) });
      }
    }
    return report;
  }

  // ---------- Sedes ----------

  private async importSites(rows: Record<string, unknown>[], dryRun: boolean): Promise<ImportReport> {
    const report = newReport(dryRun, rows.length);
    const customerCache = new Map<string, Customer | null>();

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const r = normalizeKeys(rows[i]);
      const customerRef = str(r, 'cliente');
      const name = str(r, 'nombre de la sede');
      if (!customerRef || !name) {
        report.errors.push({ row: rowNum, message: 'Cliente y nombre de la sede son obligatorios' });
        continue;
      }
      const customer = await this.findCustomer(customerRef, customerCache);
      if (!customer) {
        report.errors.push({ row: rowNum, field: 'Cliente', message: `No existe el cliente "${customerRef}" — impórtalo primero` });
        continue;
      }

      const data = {
        addressLine: str(r, 'dirección') || str(r, 'direccion') || undefined,
        city: str(r, 'ciudad') || undefined,
        contactName: str(r, 'contacto') || undefined,
        phone: str(r, 'teléfono') || str(r, 'telefono') || undefined,
        notes: str(r, 'notas') || undefined,
      };

      try {
        const existing = await this.prisma.customerSite.findFirst({
          where: { customerId: customer.id, name: { equals: name, mode: 'insensitive' } },
        });
        if (existing) {
          if (!dryRun) await this.prisma.customerSite.update({ where: { id: existing.id }, data });
          report.updated++;
        } else {
          if (!dryRun) await this.prisma.customerSite.create({ data: { ...data, customerId: customer.id, name } });
          report.created++;
        }
      } catch (e) {
        report.errors.push({ row: rowNum, message: errMsg(e) });
      }
    }
    return report;
  }

  // ---------- Helpers ----------

  private async findCustomer(ref: string, cache: Map<string, Customer | null>): Promise<Customer | null> {
    const key = ref.trim().toUpperCase();
    if (cache.has(key)) return cache.get(key)!;
    const customer =
      (await this.prisma.customer.findUnique({ where: { code: key } })) ??
      (await this.prisma.customer.findFirst({ where: { taxId: ref.trim() } })) ??
      (await this.prisma.customer.findFirst({ where: { name: { equals: ref.trim(), mode: 'insensitive' } } }));
    cache.set(key, customer);
    return customer;
  }

  private async nextCustomerCodeNumber(): Promise<number> {
    const last = await this.prisma.customer.findFirst({
      where: { code: { startsWith: 'CL-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = last ? parseInt(last.code.slice(3), 10) : 0;
    return Number.isNaN(lastNum) ? 1 : lastNum + 1;
  }
}

// ---------- utilidades de parseo ----------

function newReport(dryRun: boolean, total: number): ImportReport {
  return { dryRun, total, created: 0, updated: 0, skipped: 0, errors: [] };
}

/** Busca la columna cuyo encabezado EMPIEZA por el nombre dado (tolerante a los sufijos "*", "(...)"). */
function str(row: Record<string, unknown>, field: string): string {
  const target = field.toLowerCase();
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith(target)) return String(value ?? '').trim();
  }
  return '';
}

function normalizeKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) out[key.trim().toLowerCase()] = value;
  return out;
}

function isExampleRow(name: string): boolean {
  return name === 'Gran Colombia S.A.S';
}

function parseServiceType(raw: string): CustomerServiceType | null {
  if (raw.startsWith('INVENTARIO')) return CustomerServiceType.INVENTORY;
  if (raw.replace(/[\s_-]/g, '').startsWith('CROSSDOCK')) return CustomerServiceType.CROSS_DOCK;
  if (raw.startsWith('AMBOS') || raw === 'BOTH') return CustomerServiceType.BOTH;
  return null;
}

function parseEnvironment(raw: string): Environment | null {
  if (raw.startsWith('CONGELADO') || raw === 'FROZEN') return Environment.FROZEN;
  if (raw.startsWith('REFRIGERADO') || raw === 'REFRIGERATED') return Environment.REFRIGERATED;
  if (raw.startsWith('SECO') || raw === 'DRY') return Environment.DRY;
  return null;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message.split('\n').pop() ?? e.message : 'Error desconocido';
}
