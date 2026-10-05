import { ApiPropertyOptional } from '@nestjs/swagger';
import { Environment } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.dto';

export class ListProductsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ enum: Environment })
  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;
}
