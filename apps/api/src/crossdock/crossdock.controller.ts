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
import { CrossDockService } from './crossdock.service';
import {
  AddDispatchDto,
  CreateCrossDockDto,
  ListCrossDockQueryDto,
  UpdateCrossDockDto,
} from './dto/crossdock.dto';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

@ApiTags('crossdock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('crossdock')
export class CrossDockController {
  constructor(private readonly crossdock: CrossDockService) {}

  @Get()
  list(@Query() query: ListCrossDockQueryDto) {
    return this.crossdock.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.crossdock.findById(id);
  }

  @Post()
  create(@Body() dto: CreateCrossDockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.crossdock.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCrossDockDto) {
    return this.crossdock.update(id, dto);
  }

  @Post(':id/dispatches')
  addDispatch(
    @Param('id') id: string,
    @Body() dto: AddDispatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crossdock.addDispatch(id, dto, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete(':id/dispatches/:dispatchId')
  removeDispatch(@Param('id') id: string, @Param('dispatchId') dispatchId: string) {
    return this.crossdock.removeDispatch(id, dispatchId);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  addReceiptPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crossdock.addPhoto({ crossDockReceiptId: id }, file, user.id);
  }

  @Post(':id/dispatches/:dispatchId/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  addDispatchPhoto(
    @Param('dispatchId') dispatchId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.crossdock.addPhoto({ crossDockDispatchId: dispatchId }, file, user.id);
  }

  @Delete('photos/:photoId')
  removePhoto(@Param('photoId') photoId: string) {
    return this.crossdock.removePhoto(photoId);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.crossdock.cancel(id);
  }
}
