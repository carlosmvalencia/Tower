import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { TareKind, UserRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsObject, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';

class UpdateSettingsDto {
  @IsObject()
  values!: Record<string, string>;
}

class CreateTareTypeDto {
  @ApiProperty({ enum: TareKind })
  @IsEnum(TareKind)
  kind!: TareKind;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  weightKg!: number;
}

class UpdateTareTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getAll() {
    return this.settings.getAll();
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settings.setMany(dto.values);
  }

  // ---------- Tipos de tara ----------

  @Get('tare-types')
  listTareTypes() {
    return this.prisma.tareType.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('tare-types')
  createTareType(@Body() dto: CreateTareTypeDto) {
    return this.prisma.tareType.create({ data: { ...dto, name: dto.name.trim() } });
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Patch('tare-types/:id')
  updateTareType(@Param('id') id: string, @Body() dto: UpdateTareTypeDto) {
    return this.prisma.tareType.update({
      where: { id },
      data: { ...dto, name: dto.name?.trim() },
    });
  }

  /** Desactivar (no borrar — puede estar referenciado en pesadas históricas). */
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('tare-types/:id')
  deactivateTareType(@Param('id') id: string) {
    return this.prisma.tareType.update({ where: { id }, data: { isActive: false } });
  }
}
