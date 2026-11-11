import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  unlink,
} from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable, Transform, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import { createGunzip, createGzip } from 'zlib';
import { extract, pack, type Pack } from 'tar-stream';
import {
  FILE_STORAGE,
  type IFileStorage,
} from '@shared/application/ports/file-storage.interface';
import {
  DATABASE_DUMPER,
  type IDatabaseDumper,
} from './ports/database-dumper.interface';

/**
 * Formato de la copia de seguridad (.tar.gz):
 *
 *   FORMAT           primera entrada: "santa-rosa-backup 1"
 *   database.dump    volcado completo de PostgreSQL (pg_dump --format=custom)
 *   files/000001     cada archivo del almacenamiento (fotos, certificados...)
 *   manifest.json    última entrada: clave original, tamaño, tipo y SHA-256 de
 *                    cada archivo, para verificar todo antes de restaurar.
 *
 * Los archivos se guardan con nombres numéricos (no con su clave) para que un
 * respaldo manipulado no pueda escribir fuera de la carpeta temporal.
 */
export const BACKUP_FORMAT = 'santa-rosa-backup';
export const BACKUP_TIME_ZONE = Symbol('BACKUP_TIME_ZONE');
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupActor {
  /** "user": desde el sistema; "cli": desde la terminal del servidor. */
  source: 'user' | 'cli';
  userId: string | null;
  username: string | null;
}

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  createdBy: BackupActor;
  database: {
    entry: string;
    size: number;
    sha256: string;
    serverVersion: string;
    lastMigration: string | null;
  };
  files: {
    entry: string;
    key: string;
    size: number;
    contentType: string;
    sha256: string;
  }[];
  totalFileBytes: number;
}

/** Copia lista para enviarse: la base ya está volcada en un archivo temporal. */
export interface PreparedBackup {
  fileName: string;
  /** Escribe el .tar.gz completo en `output` y libera los temporales. */
  writeTo(output: Writable): Promise<BackupManifest>;
  /** Libera los temporales si no se va a llamar a writeTo. */
  dispose(): Promise<void>;
}

/** Respaldo leído y verificado, listo para restaurar. */
export interface VerifiedBackup {
  manifest: BackupManifest;
  /** Restaura la base y los archivos. */
  restore(): Promise<{ uploaded: number; deleted: number }>;
  dispose(): Promise<void>;
}

/** Respaldo guardado en la carpeta de respaldos del servidor. */
export interface SavedBackup {
  fileName: string;
  path: string;
  size: number;
  manifest: BackupManifest;
}

/** Archivo de la carpeta de respaldos del servidor. */
export interface BackupFileInfo {
  fileName: string;
  size: number;
  modifiedAt: Date;
}

export interface RestoreResult {
  uploaded: number;
  deleted: number;
  /** Respaldo del estado anterior, generado antes de restaurar. */
  safetyCopy: SavedBackup | null;
}

export class BackupInProgressError extends Error {
  constructor(kind: 'backup' | 'restore' = 'backup') {
    super(
      kind === 'restore'
        ? 'Hay una restauración en curso. Espere a que termine.'
        : 'Ya se está generando una copia de seguridad. Espere a que termine.',
    );
  }
}

export class InvalidBackupError extends Error {}

const ENTRY_NAME = /^(FORMAT|database\.dump|manifest\.json|files\/\d{6})$/;

/** Nombres aceptados para los archivos de la carpeta de respaldos. */
export const BACKUP_FILE_NAME = /^[\w.-]+\.tar\.gz$/;

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  /** Un solo respaldo o restauración a la vez. */
  private busy: 'backup' | 'restore' | null = null;

  constructor(
    @Inject(DATABASE_DUMPER) private readonly dumper: IDatabaseDumper,
    @Inject(FILE_STORAGE) private readonly storage: IFileStorage,
    /** Zona horaria del nombre del archivo (la de la cabaña). */
    @Inject(BACKUP_TIME_ZONE) private readonly timeZone: string,
  ) {}

  /**
   * Vuelca la base antes de empezar a enviar, para que un error de la base se
   * informe como error y no como una descarga cortada.
   */
  async prepare(actor: BackupActor, now = new Date()): Promise<PreparedBackup> {
    if (this.busy) throw new BackupInProgressError(this.busy);
    this.busy = 'backup';
    try {
      return await this.build(actor, now, () => (this.busy = null));
    } catch (error) {
      this.busy = null;
      throw error;
    }
  }

  /** Genera un respaldo y lo guarda en `dir` (primero como .partial). */
  async saveToDirectory(
    actor: BackupActor,
    dir: string,
    prefix = '',
  ): Promise<SavedBackup> {
    return writeBackupFile(await this.prepare(actor), dir, prefix);
  }

  /**
   * Restaura un respaldo ya verificado. Si se indica `safetyCopyDir`, antes
   * guarda allí un respaldo del estado actual ("antes-de-restaurar-…"); si ese
   * respaldo falla, no se restaura nada.
   */
  async restoreVerified(
    backup: VerifiedBackup,
    options: { actor: BackupActor; safetyCopyDir: string | null },
  ): Promise<RestoreResult> {
    if (this.busy) throw new BackupInProgressError(this.busy);
    this.busy = 'restore';
    try {
      const safetyCopy = options.safetyCopyDir
        ? await writeBackupFile(
            await this.build(options.actor, new Date(), () => undefined),
            options.safetyCopyDir,
            'antes-de-restaurar-',
          )
        : null;
      const result = await backup.restore();
      return { ...result, safetyCopy };
    } finally {
      this.busy = null;
    }
  }

  private async build(
    actor: BackupActor,
    now: Date,
    onRelease: () => void,
  ): Promise<PreparedBackup> {
    const dir = await mkdtemp(join(tmpdir(), 'santa-rosa-backup-'));
    let released = false;
    const release = async () => {
      if (released) return;
      released = true;
      onRelease();
      await rm(dir, { recursive: true, force: true });
    };
    try {
      const dumpPath = join(dir, 'database.dump');
      await this.dumper.dump(dumpPath);
      const info = await this.dumper.describe();
      const dumpSize = (await stat(dumpPath)).size;
      const dumpHash = await hashFile(dumpPath);
      const fileName = `santa-rosa-respaldo-${timestamp(now, this.timeZone)}.tar.gz`;

      return {
        fileName,
        dispose: release,
        writeTo: async (output) => {
          try {
            const manifest: BackupManifest = {
              format: BACKUP_FORMAT,
              version: BACKUP_FORMAT_VERSION,
              createdAt: now.toISOString(),
              createdBy: actor,
              database: {
                entry: 'database.dump',
                size: dumpSize,
                sha256: dumpHash,
                ...info,
              },
              files: [],
              totalFileBytes: 0,
            };
            const tar = pack();
            const written = pipeline(tar, createGzip(), output);
            await addEntry(
              tar,
              'FORMAT',
              Readable.from([
                Buffer.from(`${BACKUP_FORMAT} ${BACKUP_FORMAT_VERSION}\n`),
              ]),
              Buffer.byteLength(`${BACKUP_FORMAT} ${BACKUP_FORMAT_VERSION}\n`),
            );
            await addEntry(
              tar,
              'database.dump',
              createReadStream(dumpPath),
              dumpSize,
            );
            for await (const object of this.storage.listAll()) {
              const file = await this.storage.openReadStream(object.key);
              if (!file) continue; // borrado mientras se respaldaba
              const entry = `files/${String(manifest.files.length + 1).padStart(6, '0')}`;
              const hash = createHash('sha256');
              await addEntry(
                tar,
                entry,
                file.stream.pipe(hashing(hash)),
                file.size,
              );
              manifest.files.push({
                entry,
                key: object.key,
                size: file.size,
                contentType: file.contentType,
                sha256: hash.digest('hex'),
              });
              manifest.totalFileBytes += file.size;
            }
            const json = Buffer.from(JSON.stringify(manifest, null, 2));
            await addEntry(
              tar,
              'manifest.json',
              Readable.from([json]),
              json.length,
            );
            tar.finalize();
            await written;
            this.logger.log(
              `Copia de seguridad generada por ${actor.username ?? actor.source}: base ${formatBytes(dumpSize)}, ${manifest.files.length} archivos (${formatBytes(manifest.totalFileBytes)})`,
            );
            return manifest;
          } finally {
            await release();
          }
        },
      };
    } catch (error) {
      await release();
      throw error;
    }
  }

  /**
   * Lee el respaldo completo en una carpeta temporal y verifica el formato, los
   * tamaños y los SHA-256. No toca la base ni el almacenamiento.
   */
  async verify(archive: Readable): Promise<VerifiedBackup> {
    const dir = await mkdtemp(join(tmpdir(), 'santa-rosa-restore-'));
    const dispose = () => rm(dir, { recursive: true, force: true });
    try {
      const hashes = new Map<string, { size: number; sha256: string }>();
      const reader = extract();
      let first = true;
      reader.on('entry', (header, stream, next) => {
        const name = header.name;
        const fail = (message: string) => {
          stream.resume();
          reader.destroy(new InvalidBackupError(message));
        };
        if (first && name !== 'FORMAT') {
          return fail('El archivo no es una copia de seguridad de Santa Rosa.');
        }
        first = false;
        if (header.type !== 'file' || !ENTRY_NAME.test(name)) {
          return fail(`Entrada inesperada en el respaldo: "${name}"`);
        }
        const hash = createHash('sha256');
        let size = 0;
        const target = join(dir, name.replace('/', '-'));
        pipeline(
          stream,
          new Transform({
            transform(chunk: Buffer, _encoding, callback) {
              hash.update(chunk);
              size += chunk.length;
              callback(null, chunk);
            },
          }),
          createWriteStream(target),
        ).then(
          () => {
            hashes.set(name, { size, sha256: hash.digest('hex') });
            next();
          },
          (error: Error) => reader.destroy(error),
        );
      });
      try {
        await pipeline(archive, createGunzip(), reader);
      } catch (error) {
        if (error instanceof InvalidBackupError) throw error;
        throw new InvalidBackupError(
          `El respaldo está dañado o incompleto: ${(error as Error).message}`,
        );
      }

      const format = await readFile(join(dir, 'FORMAT'), 'utf8').catch(
        () => '',
      );
      const [name, version] = format.trim().split(' ');
      if (name !== BACKUP_FORMAT || Number(version) !== BACKUP_FORMAT_VERSION) {
        throw new InvalidBackupError(
          `Formato de respaldo no soportado: "${format.trim()}"`,
        );
      }
      if (!hashes.has('manifest.json')) {
        throw new InvalidBackupError(
          'El respaldo está incompleto: falta manifest.json.',
        );
      }
      const manifest = JSON.parse(
        await readFile(join(dir, 'manifest.json'), 'utf8'),
      ) as BackupManifest;
      const check = (entry: string, size: number, sha256: string) => {
        const found = hashes.get(entry);
        if (!found || found.size !== size || found.sha256 !== sha256) {
          throw new InvalidBackupError(
            `El respaldo está dañado: "${entry}" no coincide con el manifiesto.`,
          );
        }
      };
      check(
        manifest.database.entry,
        manifest.database.size,
        manifest.database.sha256,
      );
      for (const file of manifest.files)
        check(file.entry, file.size, file.sha256);
      const local = (entry: string) => join(dir, entry.replace('/', '-'));

      return {
        manifest,
        dispose,
        restore: async () => {
          await this.dumper.restore(local(manifest.database.entry));
          this.logger.warn(
            `Base de datos restaurada desde el respaldo del ${manifest.createdAt}`,
          );
          const keep = new Set(manifest.files.map((f) => f.key));
          for (const file of manifest.files) {
            await this.storage.save(
              file.key,
              await readFile(local(file.entry)),
              file.contentType,
            );
          }
          const extra: string[] = [];
          for await (const object of this.storage.listAll()) {
            if (!keep.has(object.key)) extra.push(object.key);
          }
          for (const key of extra) await this.storage.delete(key);
          this.logger.warn(
            `Archivos restaurados: ${manifest.files.length}; eliminados por no estar en el respaldo: ${extra.length}`,
          );
          return { uploaded: manifest.files.length, deleted: extra.length };
        },
      };
    } catch (error) {
      await dispose();
      throw error;
    }
  }
}

/** Respaldos (.tar.gz) de la carpeta, del más reciente al más antiguo. */
export async function listBackupFiles(dir: string): Promise<BackupFileInfo[]> {
  if (!existsSync(dir)) return [];
  const files: BackupFileInfo[] = [];
  for (const fileName of await readdir(dir)) {
    if (!BACKUP_FILE_NAME.test(fileName)) continue;
    const info = await stat(join(dir, fileName));
    if (info.isFile()) {
      files.push({ fileName, size: info.size, modifiedAt: info.mtime });
    }
  }
  return files.sort((a, b) => +b.modifiedAt - +a.modifiedAt);
}

/** Escribe el respaldo en `dir` (primero con extensión .partial). */
export async function writeBackupFile(
  backup: PreparedBackup,
  dir: string,
  prefix = '',
): Promise<SavedBackup> {
  await mkdir(dir, { recursive: true });
  const fileName = `${prefix}${backup.fileName}`;
  const path = join(dir, fileName);
  const partial = `${path}.partial`;
  try {
    const manifest = await backup.writeTo(createWriteStream(partial));
    await rename(partial, path);
    return { fileName, path, size: (await stat(path)).size, manifest };
  } catch (error) {
    await backup.dispose();
    await unlink(partial).catch(() => undefined);
    throw error;
  }
}

function addEntry(
  tar: Pack,
  name: string,
  content: Readable,
  size: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const entry = tar.entry(
      { name, size, mode: 0o600, mtime: new Date() },
      (error) => (error ? reject(error) : resolve()),
    );
    content.on('error', reject);
    content.pipe(entry);
  });
}

/** Deja pasar los datos y va calculando su hash. */
function hashing(hash: ReturnType<typeof createHash>): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path))
    hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** "20261104-153301" en la zona horaria indicada. */
function timestamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}
