export const RESTORE_FINALIZER = Symbol('RESTORE_FINALIZER');

/**
 * Lo que la API hace con la base recién restaurada para que quede lista sin
 * reiniciar: aplicar las migraciones que falten y sincronizar los permisos.
 */
export interface IRestoreFinalizer {
  /** Migraciones que conoce esta versión del sistema, de la más antigua a la más nueva. */
  knownMigrations(): string[];
  /** Aplica las migraciones pendientes y sincroniza el catálogo de permisos. */
  finalize(): Promise<{ migrationsApplied: string[] }>;
}
