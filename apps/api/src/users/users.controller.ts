import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersQueryDto } from './dto/list-users.dto';
import { BulkDeleteDto } from '../common/bulk-delete.helper';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.findById(user.id);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Roles(UserRole.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() current: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, current.id);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() current: AuthenticatedUser) {
    return this.users.deactivate(id, current.id);
  }

  /**
   * Genera una contraseña temporal aleatoria para otro usuario (typical flow:
   * el usuario olvidó la suya). Devuelve la contraseña UNA SOLA VEZ.
   * Cierra todas las sesiones activas del usuario.
   */
  @Roles(UserRole.ADMIN)
  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @CurrentUser() current: AuthenticatedUser) {
    return this.users.resetPassword(id, current.id);
  }

  /** Elimina permanentemente varios usuarios. Aplica salvaguardas del sistema. */
  @Roles(UserRole.ADMIN)
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteDto, @CurrentUser() current: AuthenticatedUser) {
    return this.users.hardDeleteMany(dto.ids, current.id);
  }
}
