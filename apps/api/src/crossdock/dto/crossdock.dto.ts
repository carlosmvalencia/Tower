import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CrossDockStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class CreateCrossDockDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivedAt?: string;

  @ApiProperty({ description: 'Cajas que entran en el descargue' })
  @IsInt()
  @Min(1)
  boxesIn!: number;

  @ApiPropertyOptional({ description: 'Peso bruto total del descargue (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  grossKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCrossDockDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  arrivedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  boxesIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  grossKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddDispatchDto {
  @ApiProperty({ description: 'Cajas que salen' })
  @IsInt()
  @Min(1)
  boxesOut!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dispatchedAt?: string;

  @ApiPropertyOptional({ description: 'Vehículo / destino' })
  @IsOptional()
  @IsString()
  destination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListCrossDockQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: CrossDockStatus })
  @IsOptional()
  @IsEnum(CrossDockStatus)
  status?: CrossDockStatus;
}
