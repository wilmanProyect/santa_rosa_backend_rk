import { readFile, writeFile } from 'fs/promises';
import { PassThrough, Readable } from 'stream';
import { gzipSync, gunzipSync } from 'zlib';
import type {
  IFileStorage,
  StoredObjectInfo,
  StoredObjectStream,
} from '@shared/application/ports/file-storage.interface';
import type { IDatabaseDumper } from './ports/database-dumper.interface';
import {
  BackupInProgressError,
  BackupService,
  InvalidBackupError,
} from './backup.service';

class MemoryStorage implements IFileStorage {
  readonly temporaryUrlTtlSeconds = 60;
  files = new Map<string, { content: Buffer; contentType: string }>();
  save(key: string, content: Buffer, contentType: string) {
    this.files.set(key, { content, contentType });
    return Promise.resolve();
  }
  read(key: string) {
    return Promise.resolve(this.files.get(key)?.content ?? null);
  }
  delete(key: string) {
    this.files.delete(key);
    return Promise.resolve();
  }
  getTemporaryUrl(key: string) {
    return Promise.resolve(`http://storage/${key}`);
  }
  async *listAll(): AsyncIterable<StoredObjectInfo> {
    for (const [key, f] of [...this.files]) {
      yield await Promise.resolve({ key, size: f.content.length });
    }
  }
  openReadStream(key: string): Promise<StoredObjectStream | null> {
    const f = this.files.get(key);
    return Promise.resolve(
      f
        ? {
            stream: Readable.from([f.content]),
            size: f.content.length,
            contentType: f.contentType,
          }
        : null,
    );
  }
}

class FakeDumper implements IDatabaseDumper {
  database = Buffer.from('PGDMP contenido de la base');
  restored: Buffer | null = null;
  async dump(filePath: string) {
    await writeFile(filePath, this.database);
  }
  async restore(filePath: string) {
    this.restored = await readFile(filePath);
  }
  describe() {
    return Promise.resolve({
      serverVersion: '17.10',
      lastMigration: 'AnimalStatusLost1793750400000',
    });
  }
}

const actor = { source: 'cli' as const, userId: null, username: null };

async function makeArchive(service: BackupService): Promise<Buffer> {
  const backup = await service.prepare(actor, new Date('2026-11-04T19:33:01Z'));
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (c: Buffer) => chunks.push(c));
  await backup.writeTo(out);
  return Buffer.concat(chunks);
}

describe('BackupService', () => {
  let storage: MemoryStorage;
  let dumper: FakeDumper;
  let service: BackupService;

  beforeEach(() => {
    storage = new MemoryStorage();
    dumper = new FakeDumper();
    service = new BackupService(dumper, storage, 'America/La_Paz');
    storage.files.set('animals/a/photos/p/original.jpg', {
      content: Buffer.from('foto'),
      contentType: 'image/jpeg',
    });
    storage.files.set('animals/a/certificate/absid.pdf', {
      content: Buffer.alloc(70_000, 7),
      contentType: 'application/pdf',
    });
  });

  it('respalda y restaura la base y los archivos tal como estaban', async () => {
    const archive = await makeArchive(service);

    // Después del respaldo cambia todo: un archivo nuevo, otro borrado.
    storage.files.delete('animals/a/photos/p/original.jpg');
    storage.files.set('animals/b/photos/x/original.png', {
      content: Buffer.from('nueva'),
      contentType: 'image/png',
    });

    const verified = await service.verify(Readable.from([archive]));
    expect(verified.manifest.files).toHaveLength(2);
    expect(verified.manifest.database.lastMigration).toBe(
      'AnimalStatusLost1793750400000',
    );
    const result = await verified.restore();
    await verified.dispose();

    expect(dumper.restored?.equals(dumper.database)).toBe(true);
    expect(result).toEqual({ uploaded: 2, deleted: 1 });
    expect([...storage.files.keys()].sort()).toEqual([
      'animals/a/certificate/absid.pdf',
      'animals/a/photos/p/original.jpg',
    ]);
    expect(storage.files.get('animals/a/photos/p/original.jpg')).toEqual({
      content: Buffer.from('foto'),
      contentType: 'image/jpeg',
    });
    expect(
      storage.files.get('animals/a/certificate/absid.pdf')?.content.length,
    ).toBe(70_000);
  });

  it('nombra el archivo con la hora de la cabaña', async () => {
    const backup = await service.prepare(
      actor,
      new Date('2026-11-04T19:33:01Z'),
    );
    expect(backup.fileName).toBe('santa-rosa-respaldo-20261104-153301.tar.gz');
    await backup.dispose();
  });

  it('no permite dos respaldos a la vez', async () => {
    const first = await service.prepare(actor);
    await expect(service.prepare(actor)).rejects.toBeInstanceOf(
      BackupInProgressError,
    );
    await first.dispose();
    await (await service.prepare(actor)).dispose();
  });

  it('rechaza un respaldo alterado sin tocar la base', async () => {
    const tar = gunzipSync(await makeArchive(service));
    const at = tar.indexOf('foto');
    tar[at] = 'F'.charCodeAt(0);
    await expect(
      service.verify(Readable.from([gzipSync(tar)])),
    ).rejects.toBeInstanceOf(InvalidBackupError);
    expect(dumper.restored).toBeNull();
  });

  it('rechaza un archivo que no es un respaldo', async () => {
    await expect(
      service.verify(Readable.from([gzipSync(Buffer.alloc(1024))])),
    ).rejects.toBeInstanceOf(InvalidBackupError);
    await expect(
      service.verify(Readable.from([Buffer.from('no es gzip')])),
    ).rejects.toBeInstanceOf(InvalidBackupError);
  });
});
