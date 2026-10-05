import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResult, Paginated, PaginationQueryDto } from '../common/pagination.dto';
import { BulkDeleteReport, describeDbError, toBulkDeleteReport } from '../common/bulk-delete.helper';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQueryDto): Promise<Paginated<unknown>> {
    const { page, pageSize, q } = query;
    const where: Prisma.CustomerWhereInput = q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { taxId: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildPaginatedResult(items, total, page, pageSize);
  }

  /** Lista liviana para selects (sin paginación). */
  async options() {
    return this.prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(dto: CreateCustomerDto) {
    const code = dto.code?.trim() || (await this.nextCode());
    await this.ensureCodeAvailable(code);
    return this.prisma.customer.create({ data: { ...dto, code } });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const existing = await this.findById(id);
    if (dto.code && dto.code !== existing.code) {
      await this.ensureCodeAvailable(dto.code);
    }
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async hardDeleteMany(ids: string[]): Promise<BulkDeleteReport> {
    const deletedIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of ids) {
      try {
        const count = await this.prisma.product.count({ where: { customerId: id } });
        if (count > 0) {
          failed.push({ id, reason: `Tiene ${count} producto(s) — elimínalos o desactiva el cliente` });
          continue;
        }
        await this.prisma.customer.delete({ where: { id } });
        deletedIds.push(id);
      } catch (e) {
        failed.push({ id, reason: describeDbError(e) });
      }
    }
    return toBulkDeleteReport(deletedIds, failed);
  }

  private async ensureCodeAvailable(code: string) {
    const exists = await this.prisma.customer.findUnique({ where: { code } });
    if (exists) throw new ConflictException(`El código ${code} ya está en uso`);
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.customer.findFirst({
      where: { code: { startsWith: 'CL-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = last ? parseInt(last.code.slice(3), 10) : 0;
    const next = Number.isNaN(lastNum) ? 1 : lastNum + 1;
    return `CL-${String(next).padStart(4, '0')}`;
  }
}
