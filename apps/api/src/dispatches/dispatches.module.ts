import { Module } from '@nestjs/common';
import { StockModule } from '../stock/stock.module';
import { DispatchesController } from './dispatches.controller';
import { DispatchesService } from './dispatches.service';

@Module({
  imports: [StockModule],
  controllers: [DispatchesController],
  providers: [DispatchesService],
})
export class DispatchesModule {}
