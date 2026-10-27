/** Fecha sin hora (YYYY-MM-DD, UTC) a partir de un Date. */
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
