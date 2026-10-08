import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
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
    return this.storage.upsertDay(dto, user.id, user.role);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete('days/:id')
  removeDay(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storage.removeDay(id, user.role);
  }

  // ---- Cierre de mes ----
  @Get('closures')
  closures(@Query('year') year: string) {
    return this.storage.listClosures(year);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('close-month')
  closeMonth(@Body('month') month: string, @CurrentUser() user: AuthenticatedUser) {
    return this.storage.closeMonth(month, user.id);
  }

  @Roles(UserRole.ADMIN)
  @Post('reopen-month')
  reopenMonth(@Body('month') month: string) {
    return this.storage.reopenMonth(month);
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

  @Get('monthly/export')
  async exportMonthly(
    @Query('customerId') customerId: string,
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.storage.exportMonthly(customerId, month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('billing')
  billing(@Query('month') month: string) {
    return this.storage.billingSummary(month);
  }

  @Get('billing/export')
  async exportBilling(@Query('month') month: string, @Res() res: Response) {
    const { filename, buffer } = await this.storage.exportBilling(month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post('mark-invoice')
  markInvoice(@Body() dto: MarkInvoiceDto) {
    return this.storage.markInvoice(dto);
  }
}
