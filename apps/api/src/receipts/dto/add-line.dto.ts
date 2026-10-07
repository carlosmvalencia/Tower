import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional()
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
