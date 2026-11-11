import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { RolesPermissionsModule } from '@modules/roles-permissions/roles-permissions.module';
import { BackupsModule } from './backups.module';
import { BACKUP_DIR, RestoreService } from './application/restore.service';
import { RESTORE_FINALIZER } from './application/ports/restore-finalizer.interface';
import { TypeormRestoreFinalizerAdapter } from './infrastructure/typeorm-restore-finalizer.adapter';
import { BackupController } from './infrastructure/backup.controller';
import { RestoreController } from './infrastructure/restore.controller';

/**
 * Endpoints de copias de seguridad: descarga (GET /backups/download) y
 * restauración desde el sistema (/backups/restore/*). La restauración guarda
 * antes un respaldo del estado actual en BACKUP_DIR (la misma carpeta que usa
 * la terminal) y después aplica las migraciones pendientes.
 */
@Module({
  imports: [BackupsModule, RolesPermissionsModule],
  controllers: [BackupController, RestoreController],
  providers: [
    RestoreService,
    { provide: RESTORE_FINALIZER, useClass: TypeormRestoreFinalizerAdapter },
    {
      provide: BACKUP_DIR,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('BACKUP_DIR') || join(process.cwd(), 'backups'),
    },
  ],
})
export class BackupsHttpModule {}
