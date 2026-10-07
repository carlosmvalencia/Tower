import { Module } from '@nestjs/common';
import { CrossDockController } from './crossdock.controller';
import { CrossDockService } from './crossdock.service';

@Module({
  controllers: [CrossDockController],
  providers: [CrossDockService],
  exports: [CrossDockService],
})
export class CrossDockModule {}
