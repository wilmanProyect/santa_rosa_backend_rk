import {
  AnimalStatus,
  Species,
} from '@modules/animals/domain/enums/animal.enums';

/** Secciones que se pueden exportar. Cada una es una o más hojas del Excel. */
export enum ExportSection {
  /** Hoja "Animales". */
  ANIMALS = 'animals',
  /** Hoja "Registro sanitario". */
  HEALTH = 'health',
  /** Hojas "Montas" y "Diagnósticos". */
  SERVICES = 'services',
  /** Hojas "Partos" y "Crías". */
  BIRTHS = 'births',
}

export const EXPORT_SECTION_LABELS: Record<ExportSection, string> = {
  [ExportSection.ANIMALS]: 'Animales',
  [ExportSection.HEALTH]: 'Registro sanitario',
  [ExportSection.SERVICES]: 'Montas y diagnósticos',
  [ExportSection.BIRTHS]: 'Partos y crías',
};

export interface ExportFilters {
  species?: Species;
  /** Fechas YYYY-MM-DD, incluidas. No se aplican a la hoja de animales. */
  from?: string;
  to?: string;
  /** Solo hoja de animales. */
  status?: AnimalStatus;
  /** Solo hoja de animales: incluir los reproductores externos. */
  includeExternal?: boolean;
}

/** Fila tal como sale de la consulta (fechas como texto YYYY-MM-DD, numéricos como texto). */
export type ExportRow = Record<string, string | number | boolean | null>;

export interface ExportData {
  animals?: ExportRow[];
  health?: ExportRow[];
  services?: ExportRow[];
  checks?: ExportRow[];
  births?: ExportRow[];
  offspring?: ExportRow[];
}
