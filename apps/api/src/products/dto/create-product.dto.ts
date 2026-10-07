import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Environment, MeasureType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty({ description: 'Código del cliente o interno; único por cliente' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ description: 'EAN/UPC para escaneo con cámara' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ enum: MeasureType, default: MeasureType.UND, description: 'KG = por peso, UND = por unidades' })
  @IsOptional()
  @IsEnum(MeasureType)
  measure?: MeasureType;

  @ApiPropertyOptional({ default: 'UND' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ enum: Environment })
  @IsEnum(Environment)
  environment!: Environment;

  @ApiPropertyOptional({ description: 'Vida útil típica en días' })
  @IsOptional()
  @IsInt()
  @Min(1)
  shelfLifeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
