import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  summary(
    @Query('customerId') customerId?: string,
    @Query('environment') environment?: string,
    @Query('q') q?: string,
  ) {
    return this.stock.summary({ customerId, environment, q });
  }

  @Get('products/:productId/lots')
  lots(@Param('productId') productId: string) {
    return this.stock.lotAvailability(productId);
  }
}
