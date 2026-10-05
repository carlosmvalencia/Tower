import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPaginatedResult, Paginated } from '../common/pagination.dto';
import { BulkDeleteReport, describeDbError, toBulkDeleteReport } from '../common/bulk-delete.helper';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.dto';
import { toSafeUser, SafeUser } from '../auth/auth.service';

export interface CreateUserResult {
  user: SafeUser;
  /** Sólo presente cuando el backend generó la contraseña (password no estaba en el DTO). */
  temporaryPassword: string | null;
}

export interface ResetPasswordResult {
  email: string;
  fullName: string;
  temporaryPassword: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async list(query: ListUsersQueryDto): Promise<Paginated<SafeUser>> {
    const { page, pageSize, q, role } = query;
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(items.map(toSafeUser), total, page, pageSize);
  }

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return toSafeUser(user);
  }

  async create(dto: CreateUserDto): Promise<CreateUserResult> {
    await this.ensureEmailAvailable(dto.email);
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 10));

    let password = dto.password;
    let temporaryPassword: string | null = null;
    if (!password) {
      password = generateRandomPassword();
      temporaryPassword = password;
    }

    const passwordHash = await bcrypt.hash(password, rounds);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
        passwordHash,
      },
    });

    return { user: toSafeUser(user), temporaryPassword };
  }

  /**
   * Actualiza un usuario con validación de "no romper el sistema":
   *   - Nadie puede modificarse a sí mismo el rol o el isActive desde esta ruta
   *     (para cambiar tu propia contraseña existe /auth/change-password).
   *   - No se puede dejar el sistema sin ningún ADMIN activo.
   */
  async update(id: string, dto: UpdateUserDto, currentUserId?: string): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    if (currentUserId && id === currentUserId) {
      // Permitimos actualizar tu propio nombre/email, pero no rol/active.
      if (dto.role && dto.role !== existing.role) {
        throw new BadRequestException('No puedes cambiarte tu propio rol.');
      }
      if (dto.isActive === false) {
        throw new BadRequestException('No puedes desactivarte a ti mismo.');
      }
    }

    // No quedar sin admins activos
    const goingNonAdmin = dto.role && dto.role !== UserRole.ADMIN && existing.role === UserRole.ADMIN;
    const goingInactive = dto.isActive === false && existing.isActive;
    if ((goingNonAdmin || goingInactive) && existing.role === UserRole.ADMIN) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, isActive: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException('No puedes degradar/desactivar al último administrador activo.');
      }
    }

    if (dto.email && dto.email !== existing.email) {
      await this.ensureEmailAvailable(dto.email);
    }

    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive,
    };
    if (dto.password) {
      const rounds = Number(this.config.get('BCRYPT_ROUNDS', 10));
      data.passwordHash = await bcrypt.hash(dto.password, rounds);
    }
    const user = await this.prisma.user.update({ where: { id }, data });
    return toSafeUser(user);
  }

  async deactivate(id: string, currentUserId?: string): Promise<SafeUser> {
    return this.update(id, { isActive: false }, currentUserId);
  }

  /**
   * Elimina permanentemente varios usuarios. Aplica todas las salvaguardas del sistema:
   * no borra al usuario actual, no borra al último admin activo, y protege usuarios
   * vinculados a un conductor (en ese caso el conductor debe eliminarse primero o
   * desvincularse).
   */
  async hardDeleteMany(ids: string[], currentUserId: string): Promise<BulkDeleteReport> {
    const deletedIds: string[] = [];
    const failed: { id: string; reason: string }[] = [];

    // Contamos admins activos una sola vez y descontamos según vamos eliminando.
    // Así detectamos cuando el batch intenta dejar al sistema sin admins.
    let activeAdminCount = await this.prisma.user.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    for (const id of ids) {
      try {
        if (id === currentUserId) {
          failed.push({ id, reason: 'No puedes eliminarte a ti mismo' });
          continue;
        }
        const u = await this.prisma.user.findUnique({ where: { id } });
        if (!u) {
          failed.push({ id, reason: 'No encontrado' });
          continue;
        }
        if (u.role === UserRole.ADMIN && u.isActive && activeAdminCount <= 1) {
          failed.push({ id, reason: 'Es el último administrador activo — no se puede eliminar' });
          continue;
        }
        // Borrar refreshTokens en cascada primero (aunque el schema ya tiene onDelete Cascade)
        await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
        await this.prisma.user.delete({ where: { id } });
        if (u.role === UserRole.ADMIN && u.isActive) activeAdminCount--;
        deletedIds.push(id);
      } catch (e) {
        failed.push({ id, reason: describeDbError(e) });
      }
    }
    return toBulkDeleteReport(deletedIds, failed);
  }

  /**
   * Genera una nueva contraseña temporal aleatoria para otro usuario.
   * Útil cuando un usuario olvida la suya. La contraseña se devuelve UNA SOLA
   * VEZ — después de eso solo queda el hash.
   * Por seguridad también revoca todos sus refresh tokens.
   */
  async resetPassword(targetUserId: string, currentUserId: string): Promise<ResetPasswordResult> {
    if (targetUserId === currentUserId) {
      throw new BadRequestException('Para cambiar tu propia contraseña usa /auth/change-password.');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('Usuario no encontrado');

    const temporaryPassword = generateRandomPassword();
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 10));
    const passwordHash = await bcrypt.hash(temporaryPassword, rounds);

    await this.prisma.user.update({ where: { id: targetUserId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId: targetUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { email: target.email, fullName: target.fullName, temporaryPassword };
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Email ya está en uso');
  }
}

/**
 * Genera una contraseña aleatoria legible (sin caracteres ambiguos como 0/O/1/l).
 * 10 caracteres = suficiente entropía para algo temporal que se cambia en el
 * primer login del usuario.
 */
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
