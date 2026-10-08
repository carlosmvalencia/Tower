import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MeasureType, Prisma, ReceiptStatus, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SettingsService } from '../settings/settings.service';
import { buildPaginatedResult, Paginated } from '../common/pagination.dto';
import { CreateReceiptDto, UpdateReceiptDto } from './dto/create-receipt.dto';
import { AddPalletDto } from './dto/add-pallet.dto';
import { AddLineDto } from './dto/add-line.dto';
import { ListReceiptsQueryDto } from './dto/list-receipts.dto';

const customerSelect = { select: { id: true, code: true, name: true } };
const productSelect = {
  select: { id: true, code: true, name: true, measure: true, unit: true, environment: true },
};

const lineInclude = {
  product: productSelect,
  tares: { include: { tareType: { select: { id: true, kind: true, name: true, weightKg: true } } } },
};

const receiptInclude = {
  customer: customerSelect,
  pallets: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      lines: {
        orderBy: { createdAt: 'asc' as const },
        include: lineInclude,
      },
    },
  },
  lines: { where: { palletId: null }, include: lineInclude },
  photos: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly settings: SettingsService,
  ) {}

  async list(query: ListReceiptsQueryDto): Promise<Paginated<unknown>> {
    const { page, pageSize, q, customerId, status } = query;
    const where: Prisma.ReceiptWhereInput = {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { customer: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.receipt.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { receivedAt: 'desc' },
        include: {
          customer: customerSelect,
          _count: { select: { pallets: true, lines: true, photos: true } },
        },
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async findById(id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: receiptInclude,
    });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
    return this.attachPhotoUrls(receipt);
  }

  async create(dto: CreateReceiptDto, userId?: string) {
    const code = await this.nextCode('receipt', 'EM-', 4);
    const receipt = await this.prisma.receipt.create({
      data: {
        code,
        customerId: dto.customerId,
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        notes: dto.notes,
        createdById: userId,
      },
      include: receiptInclude,
    });
    return this.attachPhotoUrls(receipt);
  }

  async update(id: string, dto: UpdateReceiptDto) {
    await this.ensureDraft(id);
    await this.prisma.receipt.update({
      where: { id },
      data: {
        receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
        notes: dto.notes,
      },
    });
    return this.findById(id);
  }

  // ---------- Estibas (cédulas) ----------

  async addPallet(receiptId: string, dto: AddPalletDto) {
    await this.ensureDraft(receiptId);
    const code = await this.nextCode('pallet', 'TW-', 6);
    return this.prisma.pallet.create({
      data: { receiptId, environment: dto.environment, code },
      include: { lines: { include: { product: productSelect } } },
    });
  }

  async removePallet(receiptId: string, palletId: string) {
    await this.ensureDraft(receiptId);
    const pallet = await this.prisma.pallet.findFirst({
      where: { id: palletId, receiptId },
      include: { _count: { select: { lines: true } } },
    });
    if (!pallet) throw new NotFoundException('Estiba no encontrada');
    if (pallet._count.lines > 0) {
      throw new BadRequestException('La estiba tiene pesadas registradas — elimínalas primero');
    }
    await this.prisma.pallet.delete({ where: { id: palletId } });
    return { ok: true };
  }

  // ---------- Pesadas (líneas) ----------

  /** Calcula la tara estándar: canastillas y estibas por sus pesos configurados. */
  async suggestTare(canastillas: number, estibas: number) {
    const canastillaKg = await this.settings.getNumber('tare.canastillaKg');
    const estibaKg = await this.settings.getNumber('tare.estibaKg');
    return {
      canastillaKg,
      estibaKg,
      tareKg: round2(canastillas * canastillaKg + estibas * estibaKg),
    };
  }

  async addLine(receiptId: string, palletId: string, dto: AddLineDto) {
    await this.ensureDraft(receiptId);
    const pallet = await this.prisma.pallet.findFirst({ where: { id: palletId, receiptId } });
    if (!pallet) throw new NotFoundException('Estiba no encontrada');

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const receipt = await this.prisma.receipt.findUniqueOrThrow({ where: { id: receiptId } });
    if (product.customerId !== receipt.customerId) {
      throw new BadRequestException('El producto no pertenece al cliente de esta recepción');
    }

    let data: Prisma.ReceiptLineUncheckedCreateInput;
    let tareItems: { tareTypeId: string; qty: number }[] = [];
    if (product.measure === MeasureType.KG) {
      if (dto.grossKg == null) {
        throw new BadRequestException(`${product.name} se maneja por KG — falta el peso bruto`);
      }
      const canastillas = dto.canastillas ?? 0;
      const estibas = dto.estibas ?? 0;

      // Tara: catálogo de tipos (nuevo) > legacy canastillas/estibas estándar
      let autoTare: number;
      if (dto.tares && dto.tares.length > 0) {
        const types = await this.prisma.tareType.findMany({
          where: { id: { in: dto.tares.map((t) => t.tareTypeId) } },
        });
        const typeById = new Map(types.map((t) => [t.id, t]));
        autoTare = 0;
        for (const item of dto.tares) {
          const type = typeById.get(item.tareTypeId);
          if (!type) throw new BadRequestException('Tipo de tara no encontrado');
          autoTare += item.qty * Number(type.weightKg);
        }
        autoTare = round2(autoTare);
        tareItems = dto.tares;
      } else {
        autoTare = (await this.suggestTare(canastillas, estibas)).tareKg;
      }

      const tareKg = dto.tareKg != null ? dto.tareKg : autoTare;
      const netKg = dto.netKg != null ? dto.netKg : round2(dto.grossKg - tareKg);
      if (netKg <= 0) {
        throw new BadRequestException('El peso neto debe ser mayor a 0 — revisa bruto y taras');
      }
      data = {
        receiptId,
        palletId,
        productId: product.id,
        lotCode: dto.lotCode.trim(),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        grossKg: dto.grossKg,
        canastillas,
        estibas,
        tareKg,
        netKg,
        notes: dto.notes,
      };
    } else {
      if (dto.units == null || dto.units <= 0) {
        throw new BadRequestException(`${product.name} se maneja por unidades — falta la cantidad`);
      }
      data = {
        receiptId,
        palletId,
        productId: product.id,
        lotCode: dto.lotCode.trim(),
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        units: dto.units,
        notes: dto.notes,
      };
    }

    return this.prisma.receiptLine.create({
      data: {
        ...data,
        ...(tareItems.length > 0 ? { tares: { create: tareItems } } : {}),
      },
      include: lineInclude,
    });
  }

  async removeLine(receiptId: string, lineId: string) {
    await this.ensureDraft(receiptId);
    const line = await this.prisma.receiptLine.findFirst({ where: { id: lineId, receiptId } });
    if (!line) throw new NotFoundException('Pesada no encontrada');
    await this.prisma.receiptLine.delete({ where: { id: lineId } });
    return { ok: true };
  }

  // ---------- Fotos ----------

  async addPhoto(receiptId: string, file: Express.Multer.File, userId?: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
    const key = await this.storage.save('receipts', file.buffer, file.originalname, file.mimetype);
    const photo = await this.prisma.photo.create({
      data: { key, receiptId, createdById: userId },
    });
    return { ...photo, url: await this.storage.getReadUrl(key) };
  }

  async removePhoto(receiptId: string, photoId: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id: photoId, receiptId } });
    if (!photo) throw new NotFoundException('Foto no encontrada');
    await this.prisma.photo.delete({ where: { id: photoId } });
    await this.storage.remove(photo.key);
    return { ok: true };
  }

  // ---------- Confirmar / cancelar ----------

  /**
   * Confirmar genera el inventario: upsert del Lote por (producto, lote) y un
   * movimiento IN en el kardex por cada pesada. A partir de aquí la recepción
   * es inmutable.
   */
  async confirm(id: string, userId?: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: { lines: { include: { product: true } } },
    });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException('Solo se puede confirmar una recepción en registro');
    }
    if (receipt.lines.length === 0) {
      throw new BadRequestException('La recepción no tiene pesadas registradas');
    }
    const orphanLines = receipt.lines.filter((l) => !l.palletId);
    if (orphanLines.length > 0) {
      throw new BadRequestException('Hay pesadas sin estiba asignada');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of receipt.lines) {
        const lot = await tx.lot.upsert({
          where: {
            productId_code: { productId: line.productId, code: line.lotCode },
          },
          update: {
            // si la línea trae vencimiento y el lote no lo tenía, se completa
            ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
          },
          create: {
            productId: line.productId,
            code: line.lotCode,
            expiryDate: line.expiryDate,
          },
        });

        const qty =
          line.product.measure === MeasureType.KG
            ? line.netKg ?? new Prisma.Decimal(0)
            : new Prisma.Decimal(line.units ?? 0);

        await tx.receiptLine.update({ where: { id: line.id }, data: { lotId: lot.id } });
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.IN,
            productId: line.productId,
            lotId: lot.id,
            qty,
            reference: `Entrada ${receipt.code}`,
            receiptLineId: line.id,
            createdById: userId,
          },
        });
      }

      await tx.receipt.update({
        where: { id },
        data: { status: ReceiptStatus.CONFIRMED, confirmedAt: new Date() },
      });
    });

    return this.findById(id);
  }

  async cancel(id: string) {
    await this.ensureDraft(id);
    await this.prisma.receipt.update({
      where: { id },
      data: { status: ReceiptStatus.CANCELLED },
    });
    return this.findById(id);
  }

  // ---------- Cédula (datos para imprimir el rótulo) ----------

  async palletLabel(palletId: string) {
    const pallet = await this.prisma.pallet.findUnique({
      where: { id: palletId },
      include: {
        receipt: { include: { customer: customerSelect } },
        lines: { include: { product: productSelect } },
      },
    });
    if (!pallet) throw new NotFoundException('Estiba no encontrada');
    return pallet;
  }

  // ---------- Helpers ----------

  private async ensureDraft(id: string) {
    const receipt = await this.prisma.receipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
    if (receipt.status !== ReceiptStatus.DRAFT) {
      throw new BadRequestException('La recepción ya no es editable (confirmada o anulada)');
    }
  }

  private async attachPhotoUrls<T extends { photos?: { key: string }[] }>(receipt: T): Promise<T> {
    if (receipt.photos) {
      const withUrls = await Promise.all(
        receipt.photos.map(async (p) => ({ ...p, url: await this.storage.getReadUrl(p.key) })),
      );
      return { ...receipt, photos: withUrls };
    }
    return receipt;
  }

  private async nextCode(model: 'receipt' | 'pallet', prefix: string, pad: number) {
    const delegate = model === 'receipt' ? this.prisma.receipt : this.prisma.pallet;
    const last = await (delegate as typeof this.prisma.receipt).findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = last ? parseInt(last.code.slice(prefix.length), 10) : 0;
    const next = Number.isNaN(lastNum) ? 1 : lastNum + 1;
    return `${prefix}${String(next).padStart(pad, '0')}`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
