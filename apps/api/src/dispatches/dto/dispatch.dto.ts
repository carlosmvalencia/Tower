import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DispatchStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class CreateDispatchDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiPropertyOptional({ description: 'Sede destino del cliente' })
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dispatchedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDispatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  siteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dispatchedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddDispatchLineDto {
  @ApiProperty()
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Lote del que sale la mercancía' })
  @IsString()
  lotId!: string;

  @ApiProperty({ description: 'Cantidad: kg (decimal) o unidades según el producto' })
  @IsNumber()
  @Min(0.01)
  qty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListDispatchesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: DispatchStatus })
  @IsOptional()
  @IsEnum(DispatchStatus)
  status?: DispatchStatus;
}
