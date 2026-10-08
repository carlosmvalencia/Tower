import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Environment, StorageChargeUnit, StorageExtraKind } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateRateDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ enum: Environment })
  @IsEnum(Environment)
  environment!: Environment;

  @ApiProperty({ enum: StorageChargeUnit, description: 'POSITION_DAY = $/posición/día, KG_DAY = $/kg/día' })
  @IsEnum(StorageChargeUnit)
  unit!: StorageChargeUnit;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  ratePerDay!: number;

  @ApiProperty({ description: 'AAAA-MM-DD desde cuándo rige' })
  @Matches(DAY)
  validFrom!: string;
}

export class CreateExtraRateDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ enum: StorageExtraKind })
  @IsEnum(StorageExtraKind)
  kind!: StorageExtraKind;

  @ApiPropertyOptional({ description: 'Nombre del concepto (para OTRO)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '$ por kg' })
  @IsNumber()
  @Min(0)
  ratePerKg!: number;

  @ApiProperty({ description: 'AAAA-MM-DD desde cuándo rige' })
  @Matches(DAY)
  validFrom!: string;
}

export class UpsertDayDto {
  @ApiProperty({ description: 'AAAA-MM-DD' })
  @Matches(DAY)
  date!: string;

  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ enum: Environment })
  @IsEnum(Environment)
  environment!: Environment;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  posIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  posOut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  kgIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  kgOut?: number;

  @ApiPropertyOptional({ description: 'Sobrescribe los kg de cargue/descargue (default: kgIn+kgOut)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kgHandledOverride?: number;

  @ApiPropertyOptional({ description: 'Kg nivelados (llegaron fuera de temperatura)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  kgLeveled?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class MarkInvoiceDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ description: 'AAAA-MM-DD' })
  @Matches(DAY)
  from!: string;

  @ApiProperty({ description: 'AAAA-MM-DD' })
  @Matches(DAY)
  to!: string;

  @ApiPropertyOptional({ description: 'No. de factura (vacío = desmarcar)' })
  @IsOptional()
  @IsString()
  invoiceRef?: string;
}
