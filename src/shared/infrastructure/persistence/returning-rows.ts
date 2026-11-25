/**
 * Filas de un `RETURNING` ejecutado con `DataSource.query()` / `manager.query()`.
 *
 * Con PostgreSQL, TypeORM devuelve las filas tal cual en un INSERT o SELECT,
 * pero en un UPDATE o DELETE devuelve `[filas, cantidad]`. Esta función acepta
 * las dos formas.
 */
export function returningRows<T>(result: unknown): T[] {
  if (
    Array.isArray(result) &&
    result.length === 2 &&
    Array.isArray(result[0]) &&
    typeof result[1] === 'number'
  ) {
    return result[0] as T[];
  }
  return result as T[];
}
