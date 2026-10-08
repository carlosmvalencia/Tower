import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { StorageControlController } from './storage-control.controller';
import { StorageControlService } from './storage-control.service';

@Module({
  imports: [SettingsModule],
  controllers: [StorageControlController],
  providers: [StorageControlService],
})
export class StorageControlModule {}
