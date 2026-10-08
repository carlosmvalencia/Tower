import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ImportService } from './import.service';
import { ImportType, TEMPLATES } from './import.types';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function assertType(type: string): ImportType {
  if (!(type in TEMPLATES)) {
    throw new BadRequestException(`Tipo de importación desconocido: ${type}`);
  }
  return type as ImportType;
}

@ApiTags('import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('import')
export class ImportController {
  constructor(private readonly importer: ImportService) {}

  @Get('templates/:type')
  template(@Param('type') type: string, @Res() res: Response) {
    const { filename, buffer } = this.importer.buildTemplate(assertType(type));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @Post(':type')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }))
  import(
    @Param('type') type: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    return this.importer.import(assertType(type), file, dryRun !== 'false');
  }
}
