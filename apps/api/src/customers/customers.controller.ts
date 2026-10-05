import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { BulkDeleteDto } from '../common/bulk-delete.helper';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.customers.list(query);
  }

  @Get('options')
  options() {
    return this.customers.options();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customers.findById(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.customers.update(id, { isActive: false });
  }

  @Roles(UserRole.ADMIN)
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.customers.hardDeleteMany(dto.ids);
  }
}
