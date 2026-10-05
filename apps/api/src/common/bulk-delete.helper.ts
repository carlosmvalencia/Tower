import { Prisma } from '@prisma/client';
import { IsArray, ArrayNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BulkDeleteDto {
  @ApiProperty({ type: [String], description: 'IDs de los registros a eliminar' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}

export interface BulkDeleteReport {
  total: number;
  deleted: number;
  failedCount: number;
  deletedIds: string[];
  failed: { id: string; reason: string }[];
}

/**
 * Traduce errores de Prisma a mensajes en español legibles para el operador.
 * Cubre los códigos que aparecen al hacer hard-delete de duplicados en producción.
 */
export function describeDbError(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const target = (e.meta?.target as string[] | undefined)?.join(', ') ?? 'campo único';
      return `Ya existe otro registro con el mismo ${target}`;
    }
    if (e.code === 'P2003') {
      const field = (e.meta?.field_name as string | undefined) ?? '';
      return `No se puede eliminar: tiene registros relacionados${field ? ` (${field})` : ''}`;
    }
    if (e.code === 'P2025') {
      return 'Registro no encontrado';
    }
    return `Error de base de datos (${e.code}): ${e.message.split('\n')[0]}`;
  }
  if (e instanceof Error) return e.message;
  return 'Error desconocido';
}

export function toBulkDeleteReport(
  deletedIds: string[],
  failed: { id: string; reason: string }[],
): BulkDeleteReport {
  return {
    total: deletedIds.length + failed.length,
    deleted: deletedIds.length,
    failedCount: failed.length,
    deletedIds,
    failed,
  };
}
