import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PermissionSeeder } from '@modules/roles-permissions/infrastructure/persistence/seeders/permission.seeder';
import type { IRestoreFinalizer } from '../application/ports/restore-finalizer.interface';

/** Timestamp final del nombre de la migración ("Reproduction1794409623224"). */
const timestampOf = (name: string) => Number(/(\d+)$/.exec(name)?.[1] ?? 0);

/**
 * Deja la base restaurada lista sin reiniciar la API: aplica las migraciones
 * pendientes (un respaldo de una versión anterior) y vuelve a crear el catálogo
 * de permisos y el rol Administrador, como al arrancar.
 */
@Injectable()
export class TypeormRestoreFinalizerAdapter implements IRestoreFinalizer {
  constructor(
    private readonly dataSource: DataSource,
    private readonly permissions: PermissionSeeder,
  ) {}

  knownMigrations(): string[] {
    return this.dataSource.migrations
      .map((m) => m.name ?? m.constructor.name)
      .sort((a, b) => timestampOf(a) - timestampOf(b));
  }

  async finalize(): Promise<{ migrationsApplied: string[] }> {
    const applied = await this.dataSource.runMigrations({ transaction: 'all' });
    await this.permissions.seed();
    return { migrationsApplied: applied.map((m) => m.name) };
  }
}
