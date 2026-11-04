/** Volcado y restauración completos de la base de datos. */
export interface IDatabaseDumper {
  /** Guarda un volcado completo de la base en el archivo indicado. */
  dump(filePath: string): Promise<void>;
  /**
   * Reemplaza TODO el contenido de la base por el del volcado, en una sola
   * transacción: si algo falla, la base queda como estaba.
   */
  restore(filePath: string): Promise<void>;
  /** Versión del servidor y última migración aplicada (para el manifiesto). */
  describe(): Promise<{
    serverVersion: string;
    lastMigration: string | null;
  }>;
}

export const DATABASE_DUMPER = Symbol('IDatabaseDumper');
