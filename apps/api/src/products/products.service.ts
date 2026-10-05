import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResult, Paginated } from '../common/pagination.dto';
import { BulkDeleteReport, describeDbError, toBulkDeleteReport } from '../common/bulk-delete.helper';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products.dto';

const customerSelect = { select: { id: true, code: true, name: true } };

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductsQueryDto): Promise<Paginated<unknown>> {
    const { page, pageSize, q, customerId, environment } = query;
    const where: Prisma.ProductWhereInput = {
      ...(customerId ? { customerId } : {}),
      ...(environment ? { environment } : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ customer: { name: 'asc' } }, { name: 'asc' }],
        include: { customer: customerSelect },
      }),
      this.prisma.product.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { customer: customerSelect },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  /** Busca por código de barras exacto — para el escaneo en piso. */
  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findFirst({
      where: { barcode, isActive: true },
      include: { customer: customerSelect },
    });
    if (!product) throw new NotFoundException('Ningún producto tiene ese código de barras');
    return product;
  }

  async create(dto: CreateProductDto) {
    await this.ensureCodeAvailable(dto.customerId, dto.code);
    return this.prisma.product.create({
      data: dto,
      include: { customer: customerSelect },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.findById(id);
    const customerId = dto.customerId ?? existing.customerId;
    const code = dto.code ?? existing.code;
    if (customerId !== existing.customerId || code !== existing.code) {
      await this.ensureCodeAvailable(customerId, code);
    }
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { customer: customerSelect },
    });
  }

  async hardDeleteMany(ids: string[]): Promise<BulkDeleteReport> {
    const deletedIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of ids) {
      try {
        await this.prisma.product.delete({ where: { id } });
        deletedIds.push(id);
      } catch (e) {
        failed.push({ id, reason: describeDbError(e) });
      }
    }
    return toBulkDeleteReport(deletedIds, failed);
  }

  private async ensureCodeAvailable(customerId: string, code: string) {
    const exists = await this.prisma.product.findUnique({
      where: { customerId_code: { customerId, code } },
    });
    if (exists) throw new ConflictException(`El cliente ya tiene un producto con código ${code}`);
  }
}
