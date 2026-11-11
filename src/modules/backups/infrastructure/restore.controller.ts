import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import {
  RESTORE_CONFIRMATION_WORD,
  RestoreService,
  type RestorePreview,
} from '../application/restore.service';
import {
  ConfirmRestoreDto,
  StageServerFileDto,
} from '../application/restore.dto';

/** Archivo que deja FileInterceptor con `dest`: guardado en disco. */
interface UploadedBackupFile {
  path: string;
  originalname: string;
  size: number;
}

/** Tamaño máximo del respaldo subido (por defecto 2 GB). */
const UPLOAD_MAX_BYTES =
  Number(process.env.BACKUP_UPLOAD_MAX_MB || 2048) * 1024 * 1024;

const actorOf = (user: AuthenticatedUser) => ({
  source: 'user' as const,
  userId: user.id,
  username: user.username,
});

@ApiTags('Copias de seguridad')
@ApiBearerAuth()
@Controller('backups')
export class RestoreController {
  constructor(private readonly restores: RestoreService) {}

  @Get('files')
  @RequirePermissions(PERMISSIONS.BACKUPS_RESTORE)
  @ApiOperation({
    summary:
      'Respaldos guardados en la carpeta del servidor (los de terminal y los generados antes de cada restauración)',
  })
  async files() {
    return (await this.restores.listServerFiles()).map((f) => ({
      fileName: f.fileName,
      size: f.size,
      modifiedAt: f.modifiedAt,
    }));
  }

  @Post('restore/upload')
  @RequirePermissions(PERMISSIONS.BACKUPS_RESTORE)
  @UseInterceptors(
    FileInterceptor('file', {
      // A disco (nombre aleatorio), no a memoria: un respaldo puede pesar cientos de MB.
      dest: tmpdir(),
      limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Paso 1: subir un respaldo (.tar.gz). Se verifica completo y queda preparado para confirmar; no modifica nada',
  })
  async upload(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: UploadedBackupFile | undefined,
  ) {
    if (!file) throw new BadRequestException('Adjunte el respaldo en "file"');
    try {
      return presentPreview(
        await this.restores.stageUpload(
          createReadStream(file.path),
          file.originalname,
          actorOf(actor),
        ),
      );
    } finally {
      // La verificación extrae su propia copia: el archivo subido ya no hace falta.
      await unlink(file.path).catch(() => undefined);
    }
  }

  @Post('restore/server-file')
  @RequirePermissions(PERMISSIONS.BACKUPS_RESTORE)
  @ApiOperation({
    summary:
      'Paso 1 (alternativa): preparar un respaldo de la carpeta del servidor; no modifica nada',
  })
  async serverFile(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: StageServerFileDto,
  ) {
    return presentPreview(
      await this.restores.stageServerFile(dto.fileName, actorOf(actor)),
    );
  }

  @Post('restore/:restoreId/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.BACKUPS_RESTORE)
  @ApiOperation({
    summary: `Paso 2: restaurar. Reemplaza TODOS los datos y archivos. Exige confirmation = "${RESTORE_CONFIRMATION_WORD}"`,
  })
  async confirm(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('restoreId', ParseUUIDPipe) restoreId: string,
    @Body() dto: ConfirmRestoreDto,
  ) {
    const outcome = await this.restores.confirm(
      restoreId,
      dto.confirmation,
      actorOf(actor),
    );
    return {
      ...outcome,
      // Los usuarios y las sesiones ahora son los del respaldo.
      sessionEnded: true,
    };
  }

  @Delete('restore/:restoreId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.BACKUPS_RESTORE)
  @ApiOperation({ summary: 'Descartar la restauración preparada' })
  async cancel(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('restoreId', ParseUUIDPipe) restoreId: string,
  ) {
    await this.restores.cancel(restoreId, actor.id);
  }
}

function presentPreview(p: RestorePreview) {
  const m = p.manifest;
  return {
    restoreId: p.restoreId,
    expiresAt: p.expiresAt,
    origin: p.origin,
    backup: {
      createdAt: m.createdAt,
      createdBy:
        m.createdBy.username ??
        (m.createdBy.source === 'cli' ? 'terminal del servidor' : null),
      database: {
        size: m.database.size,
        serverVersion: m.database.serverVersion,
        lastMigration: m.database.lastMigration,
      },
      files: m.files.length,
      totalFileBytes: m.totalFileBytes,
    },
    pendingMigrations: p.pendingMigrations,
  };
}
