import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { StorageControlService } from './storage-control.service';
import {
  CreateExtraRateDto,
  CreateRateDto,
  MarkInvoiceDto,
  UpsertDayDto,
} from './dto/storage-control.dto';

@ApiTags('storage-control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('storage-control')
export class StorageControlController {
  constructor(private readonly storage: StorageControlService) {}

  // ---- Tarifas ----
  @Get('rates/:customerId')
  listRates(@Param('customerId') customerId: string) {
    return this.storage.listRates(customerId);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('rates')
  createRate(@Body() dto: CreateRateDto) {
    return this.storage.createRate(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('rates/:id')
  deleteRate(@Param('id') id: string) {
    return this.storage.deleteRate(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('extra-rates')
  createExtraRate(@Body() dto: CreateExtraRateDto) {
    return this.storage.createExtraRate(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('extra-rates/:id')
  deleteExtraRate(@Param('id') id: string) {
    return this.storage.deleteExtraRate(id);
  }

  // ---- Registro diario ----
  @Get('days')
  dayGrid(@Query('date') date: string) {
    return this.storage.dayGrid(date);
  }

  @Put('days')
  upsertDay(@Body() dto: UpsertDayDto, @CurrentUser() user: AuthenticatedUser) {
    return this.storage.upsertDay(dto, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('days/:id')
  removeDay(@Param('id') id: string) {
    return this.storage.removeDay(id);
  }

  // ---- Paneles ----
  @Get('occupancy')
  occupancy(@Query('from') from: string, @Query('to') to: string) {
    return this.storage.occupancy(from, to);
  }

  @Get('monthly')
  monthly(@Query('customerId') customerId: string, @Query('month') month: string) {
    return this.storage.monthly(customerId, month);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('mark-invoice')
  markInvoice(@Body() dto: MarkInvoiceDto) {
    return this.storage.markInvoice(dto);
  }
}
