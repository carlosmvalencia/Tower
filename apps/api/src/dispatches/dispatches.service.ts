import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DispatchStatus, MeasureType, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StockService } from '../stock/stock.service';
import { buildPaginatedResult, Paginated } from '../common/pagination.dto';
import {
  AddDispatchLineDto,
  CreateDispatchDto,
  ListDispatchesQueryDto,
  UpdateDispatchDto,
} from './dto/dispatch.dto';

const customerSelect = { select: { id: true, code: true, name: true } };
const productSelect = {
  select: { id: true, code: true, name: true, measure: true, unit: true, environment: true },
};
const lotSelect = { select: { id: true, code: true, expiryDate: true } };

const dispatchInclude = {
  customer: customerSelect,
  site: true,
  lines: {
    orderBy: { createdAt: 'asc' as const },
    include: { product: productSelect, lot: lotSelect },
  },
  photos: { orderBy: { createdAt: 'asc' as const } },
};

@Injectable()
export class DispatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly stock: StockService,
  ) {}

  async list(query: ListDispatchesQueryDto): Promise<Paginated<unknown>> {
    const { page, pageSize, q, customerId, status } = query;
    const where: Prisma.DispatchWhereInput = {
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { customer: { name: { contains: q, mode: 'insensitive' } } },
              { site: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dispatch.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { dispatchedAt: 'desc' },
        include: {
          customer: customerSelect,
          site: { select: { id: true, name: true, city: true } },
          _count: { select: { lines: true, photos: true } },
        },
      }),
      this.prisma.dispatch.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async findById(id: string) {
    const dispatch = await this.prisma.dispatch.findUnique({
      where: { id },
      include: dispatchInclude,
    });
    if (!dispatch) throw new NotFoundException('Salida no encontrada');
    return this.attachPhotoUrls(dispatch);
  }

  async create(dto: CreateDispatchDto, userId?: string) {
    await this.validateSite(dto.customerId, dto.siteId);
    const code = await this.nextCode();
    const dispatch = await this.prisma.dispatch.create({
      data: {
        code,
        customerId: dto.customerId,
        siteId: dto.siteId,
        dispatchedAt: dto.dispatchedAt ? new Date(dto.dispatchedAt) : undefined,
        notes: dto.notes,
        createdById: userId,
      },
      include: dispatchInclude,
    });
    return this.attachPhotoUrls(dispatch);
  }

  async update(id: string, dto: UpdateDispatchDto) {
    const dispatch = await this.ensureDraft(id);
    if (dto.siteId) await this.validateSite(dispatch.customerId, dto.siteId);
    await this.prisma.dispatch.update({
      where: { id },
      data: {
        siteId: dto.siteId,
        dispatchedAt: dto.dispatchedAt ? new Date(dto.dispatchedAt) : undefined,
        notes: dto.notes,
      },
    });
    return this.findById(id);
  }

  // ---------- Líneas ----------

  async addLine(dispatchId: string, dto: AddDispatchLineDto) {
    const dispatch = await this.ensureDraft(dispatchId);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.customerId !== dispatch.customerId) {
      throw new BadRequestException('El producto no pertenece al cliente de esta salida');
    }
    if (product.measure === MeasureType.UND && !Number.isInteger(dto.qty)) {
      throw new BadRequestException(`${product.name} se maneja por unidades enteras`);
    }

    const lot = await this.prisma.lot.findUnique({ where: { id: dto.lotId } });
    if (!lot || lot.productId !== product.id) {
      throw new BadRequestException('El lote no corresponde al producto');
    }

    // Disponible = saldo del lote menos lo ya reservado en ESTA salida en borrador
    const available = await this.stock.availableForLot(dto.lotId);
    const reserved = await this.reservedInDraft(dispatchId, dto.lotId);
    const free = available - reserved;
    if (dto.qty > free) {
      throw new BadRequestException(
        `Disponible del lote ${lot.code}: ${free.toFixed(2)} — no alcanza para ${dto.qty}`,
      );
    }

    return this.prisma.dispatchLine.create({
      data: {
        dispatchId,
        productId: product.id,
        lotId: lot.id,
        qty: dto.qty,
        notes: dto.notes,
      },
      include: { product: productSelect, lot: lotSelect },
    });
  }

  async removeLine(dispatchId: string, lineId: string) {
    await this.ensureDraft(dispatchId);
    const line = await this.prisma.dispatchLine.findFirst({ where: { id: lineId, dispatchId } });
    if (!line) throw new NotFoundException('Línea no encontrada');
    await this.prisma.dispatchLine.delete({ where: { id: lineId } });
    return { ok: true };
  }

  // ---------- Fotos ----------

  async addPhoto(dispatchId: string, file: Express.Multer.File, userId?: string) {
    const dispatch = await this.prisma.dispatch.findUnique({ where: { id: dispatchId } });
    if (!dispatch) throw new NotFoundException('Salida no encontrada');
    const key = await this.storage.save('dispatches', file.buffer, file.originalname, file.mimetype);
    const photo = await this.prisma.photo.create({
      data: { key, dispatchId, createdById: userId },
    });
    return { ...photo, url: await this.storage.getReadUrl(key) };
  }

  async removePhoto(dispatchId: string, photoId: string) {
    const photo = await this.prisma.photo.findFirst({ where: { id: photoId, dispatchId } });
    if (!photo) throw new NotFoundException('Foto no encontrada');
    await this.prisma.photo.delete({ where: { id: photoId } });
    await this.storage.remove(photo.key);
    return { ok: true };
  }

  // ---------- Confirmar / cancelar ----------

  /** Confirmar descuenta inventario: un movimiento OUT por línea. */
  async confirm(id: string, userId?: string) {
    const dispatch = await this.prisma.dispatch.findUnique({
      where: { id },
      include: { lines: { include: { lot: true } } },
    });
    if (!dispatch) throw new NotFoundException('Salida no encontrada');
    if (dispatch.status !== DispatchStatus.DRAFT) {
      throw new BadRequestException('Solo se puede confirmar una salida en registro');
    }
    if (dispatch.lines.length === 0) {
      throw new BadRequestException('La salida no tiene líneas');
    }

    // Re-validar disponibilidad por lote (puede haber cambiado desde que se agregó la línea)
    const neededByLot = new Map<string, { code: string; needed: number }>();
    for (const line of dispatch.lines) {
      const entry = neededByLot.get(line.lotId) ?? { code: line.lot.code, needed: 0 };
      entry.needed += Number(line.qty);
      neededByLot.set(line.lotId, entry);
    }
    for (const [lotId, { code, needed }] of neededByLot) {
      const available = await this.stock.availableForLot(lotId);
      if (needed > available) {
        throw new BadRequestException(
          `El lote ${code} ya no tiene saldo suficiente (disponible ${available.toFixed(2)}, requerido ${needed.toFixed(2)})`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const line of dispatch.lines) {
        await tx.stockMovement.create({
          data: {
            type: StockMovementType.OUT,
            productId: line.productId,
            lotId: line.lotId,
            qty: line.qty,
            reference: `Salida ${dispatch.code}`,
            dispatchLineId: line.id,
            createdById: userId,
          },
        });
      }
      await tx.dispatch.update({
        where: { id },
        data: { status: DispatchStatus.CONFIRMED, confirmedAt: new Date() },
      });
    });

    return this.findById(id);
  }

  async cancel(id: string) {
    await this.ensureDraft(id);
    await this.prisma.dispatch.update({
      where: { id },
      data: { status: DispatchStatus.CANCELLED },
    });
    return this.findById(id);
  }

  // ---------- Helpers ----------

  private async ensureDraft(id: string) {
    const dispatch = await this.prisma.dispatch.findUnique({ where: { id } });
    if (!dispatch) throw new NotFoundException('Salida no encontrada');
    if (dispatch.status !== DispatchStatus.DRAFT) {
      throw new BadRequestException('La salida ya no es editable (confirmada o anulada)');
    }
    return dispatch;
  }

  private async validateSite(customerId: string, siteId?: string) {
    if (!siteId) return;
    const site = await this.prisma.customerSite.findUnique({ where: { id: siteId } });
    if (!site || site.customerId !== customerId) {
      throw new BadRequestException('La sede no pertenece al cliente');
    }
  }

  private async reservedInDraft(dispatchId: string, lotId: string): Promise<number> {
    const agg = await this.prisma.dispatchLine.aggregate({
      where: { dispatchId, lotId },
      _sum: { qty: true },
    });
    return Number(agg._sum.qty ?? 0);
  }

  private async attachPhotoUrls<T extends { photos?: { key: string }[] }>(d: T): Promise<T> {
    if (d.photos) {
      const withUrls = await Promise.all(
        d.photos.map(async (p) => ({ ...p, url: await this.storage.getReadUrl(p.key) })),
      );
      return { ...d, photos: withUrls };
    }
    return d;
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.dispatch.findFirst({
      where: { code: { startsWith: 'SM-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = last ? parseInt(last.code.slice(3), 10) : 0;
    const next = Number.isNaN(lastNum) ? 1 : lastNum + 1;
    return `SM-${String(next).padStart(4, '0')}`;
  }
}
