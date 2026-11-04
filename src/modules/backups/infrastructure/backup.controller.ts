import {
  ConflictException,
  Controller,
  Get,
  Header,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { PassThrough } from 'stream';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { contentDisposition } from '@shared/infrastructure/storage/s3-file-storage.adapter';
import {
  BackupInProgressError,
  BackupService,
} from '../application/backup.service';

@ApiTags('Copias de seguridad')
@ApiBearerAuth()
@Controller('backups')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backups: BackupService) {}

  @Get('download')
  @RequirePermissions(PERMISSIONS.BACKUPS_CREATE)
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiProduces('application/gzip')
  @ApiOperation({
    summary:
      'Descargar una copia de seguridad completa (.tar.gz): base de datos, fotos y certificados',
  })
  async download(@CurrentUser() actor: AuthenticatedUser) {
    let backup;
    try {
      backup = await this.backups.prepare({
        source: 'user',
        userId: actor.id,
        username: actor.username,
      });
    } catch (error) {
      if (error instanceof BackupInProgressError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    const output = new PassThrough();
    backup.writeTo(output).catch((error: Error) => {
      // Las cabeceras ya se enviaron: se corta la descarga para que el
      // navegador la marque como fallida en vez de guardar un archivo roto.
      this.logger.error(`Falló la copia de seguridad: ${error.message}`);
      output.destroy(error);
    });
    return new StreamableFile(output, {
      type: 'application/gzip',
      disposition: contentDisposition(backup.fileName, true),
    });
  }
}
