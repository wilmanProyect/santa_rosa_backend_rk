/**
 * Copias de seguridad por terminal. Se ejecuta dentro del contenedor de la API,
 * que ya trae las herramientas de PostgreSQL:
 *
 *   pnpm backup                         # genera un respaldo en ./backups
 *   pnpm backup:list                    # lista los respaldos de ./backups
 *   pnpm restore <archivo.tar.gz>       # restaura (pide confirmación)
 *
 * Antes de restaurar se genera automáticamente un respaldo del estado actual,
 * salvo que se pase --sin-respaldo-previo.
 */
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createReadStream, existsSync } from 'fs';
import { basename, isAbsolute, join } from 'path';
import { createInterface } from 'readline/promises';
import { BackupsModule } from '../backups.module';
import {
  BackupService,
  formatBytes,
  listBackupFiles,
  type SavedBackup,
} from '../application/backup.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    BackupsModule,
  ],
})
class BackupCliModule {}

const BACKUP_DIR = process.env.BACKUP_DIR || join(process.cwd(), 'backups');
const CONFIRMATION_WORD = 'RESTAURAR';

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const [target] = rest.filter((a) => !a.startsWith('--'));

  if (command === 'list') return list();
  if (command !== 'backup' && command !== 'restore') {
    console.log(
      'Uso:\n  backup               genera un respaldo\n  list                 lista los respaldos\n  restore <archivo>    restaura un respaldo [--yes] [--sin-respaldo-previo]',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(BackupCliModule, {
    logger: ['error', 'warn'],
  });
  try {
    const service = app.get(BackupService);
    if (command === 'backup') {
      report(await service.saveToDirectory(cliActor(), BACKUP_DIR));
      return;
    }

    if (!target) throw new Error('Indique el archivo a restaurar.');
    const file =
      isAbsolute(target) || existsSync(target)
        ? target
        : join(BACKUP_DIR, basename(target));
    if (!existsSync(file)) throw new Error(`No existe el archivo ${file}`);

    console.log(`Verificando ${basename(file)}...`);
    const backup = await service.verify(createReadStream(file));
    try {
      const m = backup.manifest;
      console.log(
        [
          '',
          `  Respaldo del:      ${new Date(m.createdAt).toLocaleString()}`,
          `  Generado por:      ${m.createdBy.username ?? 'terminal del servidor'}`,
          `  Base de datos:     ${formatBytes(m.database.size)} (PostgreSQL ${m.database.serverVersion}, migración ${m.database.lastMigration ?? '-'})`,
          `  Archivos:          ${m.files.length} (${formatBytes(m.totalFileBytes)})`,
          '',
          '  ATENCIÓN: se reemplazarán TODOS los datos y archivos actuales por los del respaldo.',
          '',
        ].join('\n'),
      );
      if (!flags.has('--yes')) {
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const answer = await rl.question(
          `Escriba ${CONFIRMATION_WORD} para continuar: `,
        );
        rl.close();
        if (answer.trim() !== CONFIRMATION_WORD) {
          console.log('Cancelado. No se modificó nada.');
          return;
        }
      }
      const safetyCopyDir = flags.has('--sin-respaldo-previo')
        ? null
        : BACKUP_DIR;
      console.log(
        safetyCopyDir
          ? 'Respaldando el estado actual y restaurando...'
          : 'Restaurando...',
      );
      const result = await service.restoreVerified(backup, {
        actor: cliActor(),
        safetyCopyDir,
      });
      if (result.safetyCopy) {
        report(result.safetyCopy);
        console.log(
          `  Si necesita volver atrás: pnpm restore ${result.safetyCopy.fileName}`,
        );
      }
      console.log(
        `\nRestauración completada: base de datos y ${result.uploaded} archivos` +
          (result.deleted
            ? ` (${result.deleted} archivos que no estaban en el respaldo se eliminaron)`
            : '') +
          '.\nReinicie la API para que aplique las migraciones pendientes: docker compose restart api',
      );
    } finally {
      await backup.dispose();
    }
  } finally {
    await app.close();
  }
}

function cliActor() {
  return { source: 'cli' as const, userId: null, username: null };
}

function report(saved: SavedBackup) {
  console.log(
    `Respaldo guardado: ${saved.path}\n  ${formatBytes(saved.size)} · base ${formatBytes(saved.manifest.database.size)} · ${saved.manifest.files.length} archivos`,
  );
}

async function list() {
  const files = await listBackupFiles(BACKUP_DIR);
  if (!files.length) {
    console.log(`No hay respaldos en ${BACKUP_DIR}`);
    return;
  }
  for (const f of [...files].reverse()) {
    console.log(`${f.fileName}  ${formatBytes(f.size)}`);
  }
}

main().catch((error: Error) => {
  console.error(`\nERROR: ${error.message}`);
  process.exit(1);
});
