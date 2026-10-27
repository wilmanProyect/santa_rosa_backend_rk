/** Escapa los comodines de LIKE/ILIKE para buscar el texto literal. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
