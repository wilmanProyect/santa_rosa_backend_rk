import { Transform } from 'class-transformer';

/** Convierte los valores de query string "true"/"false" a booleanos reales. */
export const BooleanQuery = () =>
  Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  });
