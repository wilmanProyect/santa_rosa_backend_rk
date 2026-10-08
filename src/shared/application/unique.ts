/** Elimina valores repetidos conservando el orden. */
export const unique = <T>(values: T[]): T[] => [...new Set(values)];
