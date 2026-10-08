import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LineTareDto {
  @ApiProperty()
  @IsString()
  tareTypeId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  qty!: number;
}

export class AddLineDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  lotCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  // --- Productos por KG ---
  @ApiPropertyOptional({ description: 'Peso bruto (con canastillas y estiba)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  grossKg?: number;

  @ApiPropertyOptional({ type: [LineTareDto], description: 'Taras usadas: N unidades de cada tipo' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineTareDto)
  tares?: LineTareDto[];

  @ApiPropertyOptional({ deprecated: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  canastillas?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estibas?: number;

  @ApiPropertyOptional({ description: 'Tara: si no se envía, se calcula con taras estándar' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tareKg?: number;

  @ApiPropertyOptional({ description: 'Neto: si no se envía, se calcula bruto - tara' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  netKg?: number;

  // --- Productos por UND ---
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  units?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
