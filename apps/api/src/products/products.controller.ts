import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkDeleteDto } from '../common/bulk-delete.helper';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.products.list(query);
  }

  @Get('by-barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string) {
    return this.products.findByBarcode(barcode);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findById(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.products.update(id, { isActive: false });
  }

  @Roles(UserRole.ADMIN)
  @Post('bulk-delete')
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.products.hardDeleteMany(dto.ids);
  }
}
