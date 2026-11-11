import { Species } from '@modules/animals/domain/enums/animal.enums';

/** Tipo de servicio (monta). */
export enum ServiceType {
  /** Monta dirigida: se elige el macho (propio o externo) para cada hembra. */
  DIRECTED = 'DIRECTED',
  /** Inseminación artificial con semen de un reproductor externo. */
  ARTIFICIAL_INSEMINATION = 'ARTIFICIAL_INSEMINATION',
}

/** Estado de una monta. Se recalcula con cada diagnóstico, parto o aborto. */
export enum ServiceStatus {
  /** Sin diagnóstico todavía. */
  PENDING = 'PENDING',
  /** Último diagnóstico: preñada. */
  PREGNANT = 'PREGNANT',
  /** Último diagnóstico: vacía (no quedó preñada o perdió la preñez). */
  EMPTY = 'EMPTY',
  /** Parió. */
  BIRTHED = 'BIRTHED',
  /** Abortó. */
  ABORTED = 'ABORTED',
}

/** Estados en los que la hembra no puede recibir otra monta. */
export const OPEN_SERVICE_STATUSES = [
  ServiceStatus.PENDING,
  ServiceStatus.PREGNANT,
];

export enum PregnancyCheckMethod {
  ULTRASOUND = 'ULTRASOUND',
  /** Observación (no repite celo, palpación, etc.). */
  OBSERVATION = 'OBSERVATION',
}

export enum PregnancyCheckResult {
  PREGNANT = 'PREGNANT',
  EMPTY = 'EMPTY',
}

export enum BirthAssistance {
  NORMAL = 'NORMAL',
  ASSISTED = 'ASSISTED',
  CESAREAN = 'CESAREAN',
}

/** Duración media de la gestación, en días. */
export const GESTATION_DAYS: Record<Species, number> = {
  [Species.SHEEP]: 147,
  [Species.GOAT]: 150,
};

/** Fuera de este rango (días desde la monta) el parto se registra con un aviso. */
export const BIRTH_WINDOW_DAYS = { min: 140, max: 160 };

/** Días después de la monta en que conviene hacer el diagnóstico de preñez. */
export const PREGNANCY_CHECK_DAYS = { from: 30, to: 45 };

/** Dos partos de la misma madre no pueden estar más cerca que esto. */
export const MIN_DAYS_BETWEEN_BIRTHS = 140;

/** Máximo de crías por parto (más de 3 se registra con un aviso). */
export const MAX_LITTER_SIZE = 4;

/** Generaciones que se revisan para detectar parentesco entre la pareja. */
export const KINSHIP_GENERATIONS = 3;
