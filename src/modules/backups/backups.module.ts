import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageModule } from '@shared/infrastructure/storage/storage.module';
import { DATABASE_DUMPER } from './application/ports/database-dumper.interface';
import { BACKUP_TIME_ZONE, BackupService } from './application/backup.service';
import { PostgresDumperAdapter } from './infrastructure/postgres-dumper.adapter';
import { BackupController } from './infrastructure/backup.controller';

/**
 * Copias de seguridad completas: base de datos + archivos del almacenamiento.
 * Se descargan desde el sistema (GET /backups/download) o se generan y
 * restauran por terminal (src/modules/backups/cli/backup.cli.ts).
 */
@Module({
  imports: [StorageModule],
  controllers: [BackupController],
  providers: [
    BackupService,
    {
      provide: BACKUP_TIME_ZONE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('FARM_TIME_ZONE', 'America/La_Paz'),
    },
    {
      provide: DATABASE_DUMPER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new PostgresDumperAdapter({
          host: config.get<string>('DB_HOST', 'localhost'),
          port: Number(config.get<string>('DB_PORT', '5432')),
          user: config.get<string>('DB_USER', 'postgres'),
          password: config.get<string>('DB_PASSWORD', ''),
          database: config.get<string>('DB_NAME', 'santa_rosa_db'),
        }),
    },
  ],
  exports: [BackupService],
})
export class BackupsModule {}
