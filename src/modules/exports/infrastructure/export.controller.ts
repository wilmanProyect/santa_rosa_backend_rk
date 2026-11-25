import { Controller, Get, Header, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { contentDisposition } from '@shared/infrastructure/storage/s3-file-storage.adapter';
import { ExportService } from '../application/export.service';
import { ExportQueryDto } from '../application/export.dto';

const XLSX =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('Exportación')
@ApiBearerAuth()
@Controller('exports')
export class ExportController {
  constructor(private readonly exports: ExportService) {}

  @Get('excel')
  @RequirePermissions(PERMISSIONS.EXPORTS_DOWNLOAD)
  @Header('Cache-Control', 'no-store')
  @ApiProduces(XLSX)
  @ApiOperation({
    summary:
      'Exportar a Excel la lista de animales, el registro sanitario, las montas (con diagnósticos) y los partos (con crías)',
  })
  async excel(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ExportQueryDto,
  ) {
    const { sections, ...filters } = query;
    const file = await this.exports.exportWorkbook(actor, sections, filters);
    return new StreamableFile(file.content, {
      type: XLSX,
      length: file.content.length,
      disposition: contentDisposition(file.fileName, true),
    });
  }
}
