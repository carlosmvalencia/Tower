import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AdjustmentDirection, MeasureType, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { buildPaginatedResult, Paginated, PaginationQueryDto } from '../common/pagination.dto';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';

const productSelect = {
  select: {
    id: true,
    code: true,
    name: true,
    measure: true,
    unit: true,
    customer: { select: { id: true, code: true, name: true } },
  },
};

@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(query: PaginationQueryDto & { customerId?: string }): Promise<Paginated<unknown>> {
    const { page, pageSize, q, customerId } = query;
    const where: Prisma.AdjustmentWhereInput = {
      ...(customerId ? { product: { customerId } } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { reason: { contains: q, mode: 'insensitive' } },
              { product: { name: { contains: q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.adjustment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: productSelect,
          lot: { select: { id: true, code: true, expiryDate: true } },
        },
      }),
      this.prisma.adjustment.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  /** El ajuste se aplica de inmediato (documento + movimiento en una transacción). */
  async create(dto: CreateAdjustmentDto, userId?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.measure === MeasureType.UND && !Number.isInteger(dto.qty)) {
      throw new BadRequestException(`${product.name} se maneja por unidades enteras`);
    }

    const lot = await this.prisma.lot.findUnique({ where: { id: dto.lotId } });
    if (!lot || lot.productId !== product.id) {
      throw new BadRequestException('El lote no corresponde al producto');
    }

    if (dto.direction === AdjustmentDirection.OUT) {
      const available = await this.stock.availableForLot(dto.lotId);
      if (dto.qty > available) {
        throw new BadRequestException(
          `El lote ${lot.code} solo tiene ${available.toFixed(2)} disponible`,
        );
      }
    }

    const code = await this.nextCode();
    return this.prisma.$transaction(async (tx) => {
      const adjustment = await tx.adjustment.create({
        data: {
          code,
          productId: product.id,
          lotId: lot.id,
          direction: dto.direction,
          qty: dto.qty,
          reason: dto.reason.trim(),
          notes: dto.notes,
          createdById: userId,
        },
        include: {
          product: productSelect,
          lot: { select: { id: true, code: true, expiryDate: true } },
        },
      });
      await tx.stockMovement.create({
        data: {
          type:
            dto.direction === AdjustmentDirection.IN
              ? StockMovementType.ADJUST_IN
              : StockMovementType.ADJUST_OUT,
          productId: product.id,
          lotId: lot.id,
          qty: dto.qty,
          reference: `Ajuste ${code}: ${dto.reason.trim()}`,
          adjustmentId: adjustment.id,
          createdById: userId,
        },
      });
      return adjustment;
    });
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.adjustment.findFirst({
      where: { code: { startsWith: 'AJ-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = last ? parseInt(last.code.slice(3), 10) : 0;
    const next = Number.isNaN(lastNum) ? 1 : lastNum + 1;
    return `AJ-${String(next).padStart(4, '0')}`;
  }
}
