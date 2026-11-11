import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Readable } from 'stream';
import type {
  BackupManifest,
  BackupService,
  VerifiedBackup,
} from './backup.service';
import { BackupInProgressError, InvalidBackupError } from './backup.service';
import type { IRestoreFinalizer } from './ports/restore-finalizer.interface';
import { RestoreService } from './restore.service';

const MIGRATIONS = ['Init1000', 'Animals2000', 'Reproduction3000'];
const actor = { source: 'user' as const, userId: 'u1', username: 'admin' };
const other = { ...actor, userId: 'u2', username: 'otro' };

function verified(lastMigration: string | null) {
  const dispose = jest.fn(() => Promise.resolve());
  const backup: VerifiedBackup = {
    manifest: {
      createdAt: '2026-11-10T15:19:18.000Z',
      database: { lastMigration },
      files: [],
    } as unknown as BackupManifest,
    restore: jest.fn(),
    dispose,
  };
  return { backup, dispose };
}

function setup(lastMigration: string | null = 'Reproduction3000') {
  const current = verified(lastMigration);
  const backups = {
    verify: jest.fn(() => Promise.resolve(current.backup)),
    restoreVerified: jest.fn(() =>
      Promise.resolve({
        uploaded: 3,
        deleted: 1,
        safetyCopy: { fileName: 'antes-de-restaurar-x.tar.gz', size: 10 },
      }),
    ),
  };
  const finalize = jest.fn(() => Promise.resolve({ migrationsApplied: [] }));
  const finalizer: IRestoreFinalizer = {
    knownMigrations: () => MIGRATIONS,
    finalize,
  };
  const service = new RestoreService(
    backups as unknown as BackupService,
    finalizer,
    '/tmp/no-existe',
  );
  return { service, backups, finalize, current };
}

const archive = () => Readable.from([Buffer.from('x')]);

describe('RestoreService', () => {
  it('prepara y restaura con la palabra de confirmación', async () => {
    const { service, backups, finalize, current } = setup();
    const preview = await service.stageUpload(archive(), 'a.tar.gz', actor);
    expect(preview.pendingMigrations).toEqual([]);

    const outcome = await service.confirm(
      preview.restoreId,
      'RESTAURAR',
      actor,
    );
    expect(backups.restoreVerified).toHaveBeenCalledWith(current.backup, {
      actor,
      safetyCopyDir: '/tmp/no-existe',
    });
    expect(finalize).toHaveBeenCalled();
    expect(outcome.safetyCopy.fileName).toBe('antes-de-restaurar-x.tar.gz');
    expect(current.dispose).toHaveBeenCalled();
    // Ya no se puede volver a confirmar.
    await expect(
      service.confirm(preview.restoreId, 'RESTAURAR', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('exige la palabra exacta y no restaura sin ella', async () => {
    const { service, backups } = setup();
    const { restoreId } = await service.stageUpload(archive(), 'a', actor);
    await expect(
      service.confirm(restoreId, 'restaurar', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(backups.restoreVerified).not.toHaveBeenCalled();
  });

  it('solo confirma quien preparó la restauración', async () => {
    const { service } = setup();
    const { restoreId } = await service.stageUpload(archive(), 'a', actor);
    await expect(
      service.confirm(restoreId, 'RESTAURAR', other),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('informa las migraciones pendientes de un respaldo anterior', async () => {
    const { service } = setup('Init1000');
    const preview = await service.stageUpload(archive(), 'a', actor);
    expect(preview.pendingMigrations).toEqual([
      'Animals2000',
      'Reproduction3000',
    ]);
  });

  it('rechaza un respaldo de una versión más nueva', async () => {
    const { service, current } = setup('Future9000');
    await expect(
      service.stageUpload(archive(), 'a', actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(current.dispose).toHaveBeenCalled();
  });

  it('traduce un respaldo inválido a 400', async () => {
    const { service, backups } = setup();
    backups.verify.mockRejectedValueOnce(new InvalidBackupError('dañado'));
    await expect(
      service.stageUpload(archive(), 'a', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('preparar otra restauración descarta la anterior', async () => {
    const { service, backups } = setup();
    const first = await service.stageUpload(archive(), 'a', actor);
    const second = verified('Init1000');
    backups.verify.mockResolvedValueOnce(second.backup);
    await service.stageUpload(archive(), 'b', actor);
    await expect(
      service.confirm(first.restoreId, 'RESTAURAR', actor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('si hay un respaldo en curso responde 409 y conserva lo preparado', async () => {
    const { service, backups } = setup();
    const { restoreId } = await service.stageUpload(archive(), 'a', actor);
    backups.restoreVerified.mockRejectedValueOnce(new BackupInProgressError());
    await expect(
      service.confirm(restoreId, 'RESTAURAR', actor),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.confirm(restoreId, 'RESTAURAR', actor),
    ).resolves.toMatchObject({ uploadedFiles: 3 });
  });
});
