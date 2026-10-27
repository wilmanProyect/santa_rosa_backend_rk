import type { ValueTransformer } from 'typeorm';

/** PostgreSQL devuelve las columnas numeric como texto: se convierten a number. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
