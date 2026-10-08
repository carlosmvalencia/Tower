import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const IN_TYPES: StockMovementType[] = ['IN', 'ADJUST_IN'];

export interface LotAvailability {
  lotId: string;
  lotCode: string;
  expiryDate: Date | null;
  available: number;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  /** Disponible por lote de un producto, ordenado FEFO (primero en vencer). */
  async lotAvailability(productId: string): Promise<LotAvailability[]> {
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['lotId', 'type'],
      where: { productId, lotId: { not: null } },
      _sum: { qty: true },
    });

    const byLot = new Map<string, number>();
    for (const g of grouped) {
      if (!g.lotId) continue;
      const sign = IN_TYPES.includes(g.type) ? 1 : -1;
      byLot.set(g.lotId, (byLot.get(g.lotId) ?? 0) + sign * Number(g._sum.qty ?? 0));
    }

    const lotIds = [...byLot.keys()];
    if (lotIds.length === 0) return [];
    const lots = await this.prisma.lot.findMany({ where: { id: { in: lotIds } } });

    return lots
      .map((lot) => ({
        lotId: lot.id,
        lotCode: lot.code,
        expiryDate: lot.expiryDate,
        available: round2(byLot.get(lot.id) ?? 0),
      }))
      .filter((l) => l.available > 0)
      .sort((a, b) => {
        // FEFO: primero el vencimiento más próximo; sin vencimiento al final
        if (a.expiryDate && b.expiryDate) return a.expiryDate.getTime() - b.expiryDate.getTime();
        if (a.expiryDate) return -1;
        if (b.expiryDate) return 1;
        return a.lotCode.localeCompare(b.lotCode);
      });
  }

  /** Disponible de un lote puntual. */
  async availableForLot(lotId: string): Promise<number> {
    const grouped = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      where: { lotId },
      _sum: { qty: true },
    });
    let total = 0;
    for (const g of grouped) {
      const sign = IN_TYPES.includes(g.type) ? 1 : -1;
      total += sign * Number(g._sum.qty ?? 0);
    }
    return round2(total);
  }

  /**
   * Saldos por producto (con filtros). Devuelve productos con existencias
   * o movimientos, su total disponible y el detalle por lote.
   */
  async summary(filters: { customerId?: string; environment?: string; q?: string }) {
    const where: Prisma.ProductWhereInput = {
      moves: { some: {} },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.environment ? { environment: filters.environment as never } : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: 'insensitive' } },
              { code: { contains: filters.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: { customer: { select: { id: true, code: true, name: true } } },
      orderBy: [{ customer: { name: 'asc' } }, { name: 'asc' }],
      take: 300,
    });

    const result = [];
    for (const product of products) {
      const lots = await this.lotAvailability(product.id);
      const total = round2(lots.reduce((s, l) => s + l.available, 0));
      result.push({ product, total, lots });
    }
    // primero los que tienen existencias
    return result.sort((a, b) => Number(b.total > 0) - Number(a.total > 0));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
