import { ApiProperty } from '@nestjs/swagger';
import { Environment } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class AddPalletDto {
  @ApiProperty({ enum: Environment, description: 'Cuarto/bodega al que entra la estiba' })
  @IsEnum(Environment)
  environment!: Environment;
}
