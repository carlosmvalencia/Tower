import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentDirection } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateAdjustmentDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty()
  @IsString()
  lotId!: string;

  @ApiProperty({ enum: AdjustmentDirection, description: 'IN suma, OUT resta' })
  @IsEnum(AdjustmentDirection)
  direction!: AdjustmentDirection;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  qty!: number;

  @ApiProperty({ description: 'Motivo del ajuste (obligatorio)' })
  @IsString()
  @MinLength(5)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
