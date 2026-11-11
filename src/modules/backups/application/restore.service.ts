import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import type { Readable } from 'stream';
import {
  BACKUP_FILE_NAME,
  BackupInProgressError,
  BackupService,
  InvalidBackupError,
  listBackupFiles,
  type BackupActor,
  type BackupFileInfo,
  type BackupManifest,
  type VerifiedBackup,
} from './backup.service';
import {
  RESTORE_FINALIZER,
  type IRestoreFinalizer,
} from './ports/restore-finalizer.interface';

export const BACKUP_DIR = Symbol('BACKUP_DIR');
export const RESTORE_CONFIRMATION_WORD = 'RESTAURAR';
/** Tiempo para confirmar una restauración preparada. */
export const RESTORE_STAGE_TTL_MS = 30 * 60 * 1000;

export type RestoreOrigin =
  | { kind: 'UPLOAD'; fileName: string }
  | { kind: 'SERVER_FILE'; fileName: string };

export interface RestorePreview {
  restoreId: string;
  expiresAt: Date;
  origin: RestoreOrigin;
  manifest: BackupManifest;
  /** Migraciones que se aplicarán después de restaurar (el respaldo es de una versión anterior). */
  pendingMigrations: string[];
}

export interface RestoreOutcome {
  restoredFrom: string;
  origin: RestoreOrigin;
  uploadedFiles: number;
  deletedFiles: number;
  safetyCopy: { fileName: string; size: number };
  migrationsApplied: string[];
}

interface StagedRestore {
  id: string;
  userId: string;
  origin: RestoreOrigin;
  backup: VerifiedBackup;
  expiresAt: Date;
  timer: NodeJS.Timeout;
  pendingMigrations: string[];
}

/**
 * Restauración desde el sistema, en dos pasos:
 *  1. `stage`: se sube un respaldo (o se elige uno de la carpeta del servidor),
 *     se verifica completo y queda preparado. No toca nada.
 *  2. `confirm`: con la palabra RESTAURAR, se guarda un respaldo del estado
 *     actual en la carpeta del servidor, se restaura, se aplican las
 *     migraciones pendientes y se sincronizan los permisos.
 *
 * Hay una sola restauración preparada a la vez: preparar otra descarta la
 * anterior. Vence a los 30 minutos.
 */
@Injectable()
export class RestoreService implements OnModuleDestroy {
  private readonly logger = new Logger(RestoreService.name);
  private staged: StagedRestore | null = null;

  constructor(
    private readonly backups: BackupService,
    @Inject(RESTORE_FINALIZER) private readonly finalizer: IRestoreFinalizer,
    @Inject(BACKUP_DIR) private readonly backupDir: string,
  ) {}

  listServerFiles(): Promise<BackupFileInfo[]> {
    return listBackupFiles(this.backupDir);
  }

  stageUpload(
    archive: Readable,
    fileName: string,
    actor: BackupActor & { userId: string },
  ): Promise<RestorePreview> {
    return this.stage(archive, { kind: 'UPLOAD', fileName }, actor);
  }

  stageServerFile(
    fileName: string,
    actor: BackupActor & { userId: string },
  ): Promise<RestorePreview> {
    const path = join(this.backupDir, fileName);
    if (!BACKUP_FILE_NAME.test(fileName) || !existsSync(path)) {
      throw new NotFoundException(
        `No existe el respaldo "${fileName}" en la carpeta del servidor`,
      );
    }
    return this.stage(
      createReadStream(path),
      { kind: 'SERVER_FILE', fileName },
      actor,
    );
  }

  async confirm(
    restoreId: string,
    confirmation: string,
    actor: BackupActor & { userId: string },
  ): Promise<RestoreOutcome> {
    const staged = this.findStaged(restoreId, actor.userId);
    if (confirmation.trim() !== RESTORE_CONFIRMATION_WORD) {
      throw new BadRequestException(
        `Escriba ${RESTORE_CONFIRMATION_WORD} para confirmar la restauración`,
      );
    }
    this.logger.warn(
      `Restauración iniciada por ${actor.username ?? actor.userId}: respaldo del ${staged.backup.manifest.createdAt} (${staged.origin.fileName})`,
    );
    let result;
    try {
      result = await this.backups.restoreVerified(staged.backup, {
        actor,
        safetyCopyDir: this.backupDir,
      });
    } catch (error) {
      if (error instanceof BackupInProgressError) {
        // La restauración preparada se conserva para reintentar.
        throw new ConflictException(error.message);
      }
      await this.discard();
      throw error;
    }
    await this.discard();
    let migrationsApplied: string[];
    try {
      ({ migrationsApplied } = await this.finalizer.finalize());
    } catch (error) {
      this.logger.error(
        `La base se restauró, pero falló al aplicar las migraciones o los permisos: ${(error as Error).message}`,
      );
      throw new InternalServerErrorException(
        `La base y los archivos se restauraron (respaldo previo: ${result.safetyCopy!.fileName}), pero falló la actualización de la base: ${(error as Error).message}. Reinicie la API para que vuelva a intentarlo.`,
      );
    }
    this.logger.warn(
      `Restauración completada: ${result.uploaded} archivos, ${result.deleted} eliminados, migraciones aplicadas: ${migrationsApplied.join(', ') || 'ninguna'}. Respaldo previo: ${result.safetyCopy!.fileName}`,
    );
    return {
      restoredFrom: staged.backup.manifest.createdAt,
      origin: staged.origin,
      uploadedFiles: result.uploaded,
      deletedFiles: result.deleted,
      safetyCopy: {
        fileName: result.safetyCopy!.fileName,
        size: result.safetyCopy!.size,
      },
      migrationsApplied,
    };
  }

  async cancel(restoreId: string, userId: string): Promise<void> {
    this.findStaged(restoreId, userId);
    await this.discard();
  }

  async onModuleDestroy(): Promise<void> {
    await this.discard();
  }

  private async stage(
    archive: Readable,
    origin: RestoreOrigin,
    actor: BackupActor & { userId: string },
  ): Promise<RestorePreview> {
    let backup: VerifiedBackup;
    try {
      backup = await this.backups.verify(archive);
    } catch (error) {
      if (error instanceof InvalidBackupError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const known = this.finalizer.knownMigrations();
    const last = backup.manifest.database.lastMigration;
    const index = last === null ? -1 : known.indexOf(last);
    if (last !== null && index === -1) {
      await backup.dispose();
      throw new ConflictException({
        code: 'BACKUP_FROM_NEWER_VERSION',
        message: `El respaldo es de una versión más nueva del sistema (migración ${last}). Actualice el sistema antes de restaurarlo.`,
      });
    }

    await this.discard();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + RESTORE_STAGE_TTL_MS);
    const timer = setTimeout(() => {
      if (this.staged?.id === id) void this.discard();
    }, RESTORE_STAGE_TTL_MS);
    timer.unref();
    this.staged = {
      id,
      userId: actor.userId,
      origin,
      backup,
      expiresAt,
      timer,
      pendingMigrations: known.slice(index + 1),
    };
    this.logger.log(
      `Restauración preparada por ${actor.username ?? actor.userId}: ${origin.fileName}, respaldo del ${backup.manifest.createdAt}`,
    );
    return {
      restoreId: id,
      expiresAt,
      origin,
      manifest: backup.manifest,
      pendingMigrations: this.staged.pendingMigrations,
    };
  }

  private findStaged(restoreId: string, userId: string): StagedRestore {
    const staged = this.staged;
    if (!staged || staged.id !== restoreId || staged.userId !== userId) {
      throw new NotFoundException(
        'La restauración preparada no existe o venció. Vuelva a subir o elegir el respaldo.',
      );
    }
    return staged;
  }

  private async discard(): Promise<void> {
    const staged = this.staged;
    if (!staged) return;
    this.staged = null;
    clearTimeout(staged.timer);
    await staged.backup.dispose();
  }
}
