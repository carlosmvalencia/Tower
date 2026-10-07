import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto, UpdateReceiptDto } from './dto/create-receipt.dto';
import { AddPalletDto } from './dto/add-pallet.dto';
import { AddLineDto } from './dto/add-line.dto';
import { ListReceiptsQueryDto } from './dto/list-receipts.dto';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

@ApiTags('receipts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  list(@Query() query: ListReceiptsQueryDto) {
    return this.receipts.list(query);
  }

  @Get('tare-suggestion')
  suggestTare(@Query('canastillas') canastillas = '0', @Query('estibas') estibas = '0') {
    return this.receipts.suggestTare(Number(canastillas) || 0, Number(estibas) || 0);
  }

  @Get('pallets/:palletId/label')
  palletLabel(@Param('palletId') palletId: string) {
    return this.receipts.palletLabel(palletId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.receipts.findById(id);
  }

  @Post()
  create(@Body() dto: CreateReceiptDto, @CurrentUser() user: AuthenticatedUser) {
    return this.receipts.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceiptDto) {
    return this.receipts.update(id, dto);
  }

  @Post(':id/pallets')
  addPallet(@Param('id') id: string, @Body() dto: AddPalletDto) {
    return this.receipts.addPallet(id, dto);
  }

  @Delete(':id/pallets/:palletId')
  removePallet(@Param('id') id: string, @Param('palletId') palletId: string) {
    return this.receipts.removePallet(id, palletId);
  }

  @Post(':id/pallets/:palletId/lines')
  addLine(
    @Param('id') id: string,
    @Param('palletId') palletId: string,
    @Body() dto: AddLineDto,
  ) {
    return this.receipts.addLine(id, palletId, dto);
  }

  @Delete(':id/lines/:lineId')
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.receipts.removeLine(id, lineId);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  addPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.receipts.addPhoto(id, file, user.id);
  }

  @Delete(':id/photos/:photoId')
  removePhoto(@Param('id') id: string, @Param('photoId') photoId: string) {
    return this.receipts.removePhoto(id, photoId);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.receipts.confirm(id, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.receipts.cancel(id);
  }
}
