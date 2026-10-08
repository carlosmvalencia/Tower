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
import { DispatchesService } from './dispatches.service';
import {
  AddDispatchLineDto,
  CreateDispatchDto,
  ListDispatchesQueryDto,
  UpdateDispatchDto,
} from './dto/dispatch.dto';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

@ApiTags('dispatches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dispatches')
export class DispatchesController {
  constructor(private readonly dispatches: DispatchesService) {}

  @Get()
  list(@Query() query: ListDispatchesQueryDto) {
    return this.dispatches.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.dispatches.findById(id);
  }

  @Post()
  create(@Body() dto: CreateDispatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dispatches.create(dto, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDispatchDto) {
    return this.dispatches.update(id, dto);
  }

  @Post(':id/lines')
  addLine(@Param('id') id: string, @Body() dto: AddDispatchLineDto) {
    return this.dispatches.addLine(id, dto);
  }

  @Delete(':id/lines/:lineId')
  removeLine(@Param('id') id: string, @Param('lineId') lineId: string) {
    return this.dispatches.removeLine(id, lineId);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES } }))
  addPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dispatches.addPhoto(id, file, user.id);
  }

  @Delete(':id/photos/:photoId')
  removePhoto(@Param('id') id: string, @Param('photoId') photoId: string) {
    return this.dispatches.removePhoto(id, photoId);
  }

  @Post(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.dispatches.confirm(id, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.dispatches.cancel(id);
  }
}
