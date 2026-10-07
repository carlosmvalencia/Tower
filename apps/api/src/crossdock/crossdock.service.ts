import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CrossDockStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { buildPaginatedResult, Paginated } from '../common/pagination.dto';
import {
  AddDispatchDto,
  CreateCrossDockDto,
  UpdateCrossDockDto,
} from './dto/crossdock.dto';
import { ListCrossDockQueryDto } from './dto/crossdock.dto';

const customerSelect = { select: { id: true, code: true, name: true } };

@Injectable()
export class CrossDockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(query: ListCrossDockQueryDto): Promise<Paginated<unknown>> {
    const { page, pageSize, q, customerId, status } = query;
    const where: Prisma.CrossDockReceiptWhereInput = {
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
      this.prisma.crossDockReceipt.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { arrivedAt: 'desc' },
        include: {
          customer: customerSelect,
          dispatches: { select: { boxesOut: true } },
          _count: { select: { photos: true } },
        },
      }),
      this.prisma.crossDockReceipt.count({ where }),
    ]);

    const withBalance = items.map((r) => ({
      ...r,
      boxesOut: r.dispatches.reduce((s, d) => s + d.boxesOut, 0),
      boxesPending: r.boxesIn - r.dispatches.reduce((s, d) => s + d.boxesOut, 0),
      dispatches: undefined,
    }));

    return buildPaginatedResult(withBalance, total, page, pageSize);
  }

  async findById(id: string) {
    const receipt = await this.prisma.crossDockReceipt.findUnique({
      where: { id },
      include: {
        customer: customerSelect,
        dispatches: {
          orderBy: { dispatchedAt: 'asc' },
          include: { photos: true },
        },
        photos: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!receipt) throw new NotFoundException('Descargue no encontrado');

    const boxesOut = receipt.dispatches.reduce((s, d) => s + d.boxesOut, 0);
    const withUrls = {
      ...receipt,
      boxesOut,
      boxesPending: receipt.boxesIn - boxesOut,
      photos: await this.photosWithUrls(receipt.photos),
      dispatches: await Promise.all(
        receipt.dispatches.map(async (d) => ({
          ...d,
          photos: await this.photosWithUrls(d.photos),
        })),
      ),
    };
    return withUrls;
  }

  async create(dto: CreateCrossDockDto, userId?: string) {
    const code = await this.nextCode();
    const created = await this.prisma.crossDockReceipt.create({
      data: {
        code,
        customerId: dto.customerId,
        arrivedAt: dto.arrivedAt ? new Date(dto.arrivedAt) : undefined,
        boxesIn: dto.boxesIn,
        grossKg: dto.grossKg,
        notes: dto.notes,
        createdById: userId,
      },
    });
    return this.findById(created.id);
  }

  async update(id: string, dto: UpdateCrossDockDto) {
    const receipt = await this.getOpen(id);
    if (dto.boxesIn != null) {
      const boxesOut = await this.totalBoxesOut(id);
      if (dto.boxesIn < boxesOut) {
        throw new BadRequestException(
          `Ya salieron ${boxesOut} cajas — las cajas de entrada no pueden ser menos`,
        );
      }
    }
    await this.prisma.crossDockReceipt.update({
      where: { id: receipt.id },
      data: {
        arrivedAt: dto.arrivedAt ? new Date(dto.arrivedAt) : undefined,
        boxesIn: dto.boxesIn,
        grossKg: dto.grossKg,
        notes: dto.notes,
      },
    });
    return this.findById(id);
  }

  // ---------- Salidas parciales ----------

  async addDispatch(id: string, dto: AddDispatchDto, userId?: string) {
    const receipt = await this.getOpen(id);
    const boxesOut = await this.totalBoxesOut(id);
    const pending = receipt.boxesIn - boxesOut;
    if (dto.boxesOut > pending) {
      throw new BadRequestException(
        `Solo quedan ${pending} caja(s) pendientes en este descargue`,
      );
    }

    await this.prisma.crossDockDispatch.create({
      data: {
        crossDockReceiptId: id,
        boxesOut: dto.boxesOut,
        dispatchedAt: dto.dispatchedAt ? new Date(dto.dispatchedAt) : undefined,
        destination: dto.destination,
        notes: dto.notes,
        createdById: userId,
      },
    });

    await this.refreshStatus(id);
    return this.findById(id);
  }

  async removeDispatch(id: string, dispatchId: string) {
    const dispatch = await this.prisma.crossDockDispatch.findFirst({
      where: { id: dispatchId, crossDockReceiptId: id },
    });
    if (!dispatch) throw new NotFoundException('Salida no encontrada');
    await this.prisma.crossDockDispatch.delete({ where: { id: dispatchId } });
    await this.refreshStatus(id);
    return this.findById(id);
  }

  // ---------- Fotos ----------

  async addPhoto(
    target: { crossDockReceiptId?: string; crossDockDispatchId?: string },
    file: Express.Multer.File,
    userId?: string,
  ) {
    const key = await this.storage.save('crossdock', file.buffer, file.originalname, file.mimetype);
    const photo = await this.prisma.photo.create({
      data: { key, ...target, createdById: userId },
    });
    return { ...photo, url: await this.storage.getReadUrl(key) };
  }

  async removePhoto(photoId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || (!photo.crossDockReceiptId && !photo.crossDockDispatchId)) {
      throw new NotFoundException('Foto no encontrada');
    }
    await this.prisma.photo.delete({ where: { id: photoId } });
    await this.storage.remove(photo.key);
    return { ok: true };
  }

  // ---------- Cancelar ----------

  async cancel(id: string) {
    const receipt = await this.prisma.crossDockReceipt.findUnique({
      where: { id },
      include: { _count: { select: { dispatches: true } } },
    });
    if (!receipt) throw new NotFoundException('Descargue no encontrado');
    if (receipt._count.dispatches > 0) {
      throw new BadRequestException('El descargue ya tiene salidas — no se puede anular');
    }
    await this.prisma.crossDockReceipt.update({
      where: { id },
      data: { status: CrossDockStatus.CANCELLED },
    });
    return this.findById(id);
  }

  // ---------- Helpers ----------

  private async getOpen(id: string) {
    const receipt = await this.prisma.crossDockReceipt.findUnique({ where: { id } });
    if (!receipt) throw new NotFoundException('Descargue no encontrado');
    if (receipt.status === CrossDockStatus.CANCELLED) {
      throw new BadRequestException('El descargue está anulado');
    }
    return receipt;
  }

  private async totalBoxesOut(id: string): Promise<number> {
    const agg = await this.prisma.crossDockDispatch.aggregate({
      where: { crossDockReceiptId: id },
      _sum: { boxesOut: true },
    });
    return agg._sum.boxesOut ?? 0;
  }

  private async refreshStatus(id: string) {
    const receipt = await this.prisma.crossDockReceipt.findUniqueOrThrow({ where: { id } });
    if (receipt.status === CrossDockStatus.CANCELLED) return;
    const boxesOut = await this.totalBoxesOut(id);
    const status = boxesOut >= receipt.boxesIn ? CrossDockStatus.CLOSED : CrossDockStatus.OPEN;
    if (status !== receipt.status) {
      await this.prisma.crossDockReceipt.update({ where: { id }, data: { status } });
    }
  }

  private async photosWithUrls<T extends { key: string }>(photos: T[]) {
    return Promise.all(
      photos.map(async (p) => ({ ...p, url: await this.storage.getReadUrl(p.key) })),
    );
  }

  private async nextCode(): Promise<string> {
    const last = await this.prisma.crossDockReceipt.findFirst({
      where: { code: { startsWith: 'CD-' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNum = last ? parseInt(last.code.slice(3), 10) : 0;
    const next = Number.isNaN(lastNum) ? 1 : lastNum + 1;
    return `CD-${String(next).padStart(4, '0')}`;
  }
}
