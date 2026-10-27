/**
 * Expresión CHECK que limita una columna varchar a los valores de un enum.
 * Si se agrega un valor al enum, cree una migración que reemplace el CHECK.
 */
export const sqlIn = (column: string, values: Record<string, string>) =>
  `"${column}" IN (${Object.values(values)
    .map((value) => `'${value}'`)
    .join(', ')})`;
