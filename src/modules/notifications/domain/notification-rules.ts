import { DomainError } from '@shared/domain/errors/domain.error';
import { addDays } from '@modules/animals/domain/models/animal-event-date';
import { BIRTH_ALERT_DAYS, ControlType } from './notification.enums';

/** Configuración de los controles y de la tarea diaria de avisos. */
export interface NotificationSettings {
  /** Meses entre controles de peso (desde el último pesaje). */
  weighingIntervalMonths: number;
  /** Meses entre controles sanitarios (desde el último registro sanitario). */
  healthIntervalMonths: number;
  /** Edad de destete, en meses. */
  weaningAgeMonths: number;
  /**
   * Solo se sigue el destete de los nacidos desde esta fecha. Evita marcar
   * como atrasados a los adultos que se destetaron antes de usar el sistema.
   */
  weaningTrackingFrom: string;
  /** Días antes del vencimiento en que un control pasa a "próximo". */
  upcomingDays: number;
  /** Hora (0 a 23, hora de la cabaña) de la revisión diaria. */
  runHour: number;
}

export const SETTINGS_LIMITS = {
  intervalMonths: { min: 1, max: 24 },
  weaningAgeMonths: { min: 1, max: 12 },
  upcomingDays: { min: 1, max: 30 },
  runHour: { min: 0, max: 23 },
};

export function assertSettings(s: NotificationSettings, today: string): void {
  const inRange = (
    value: number,
    { min, max }: { min: number; max: number },
    label: string,
  ) => {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new DomainError(
        `${label} debe ser un entero entre ${min} y ${max}`,
      );
    }
  };
  const L = SETTINGS_LIMITS;
  inRange(
    s.weighingIntervalMonths,
    L.intervalMonths,
    'Los meses entre controles de peso',
  );
  inRange(
    s.healthIntervalMonths,
    L.intervalMonths,
    'Los meses entre controles sanitarios',
  );
  inRange(s.weaningAgeMonths, L.weaningAgeMonths, 'La edad de destete (meses)');
  inRange(s.upcomingDays, L.upcomingDays, 'Los días de anticipación');
  inRange(s.runHour, L.runHour, 'La hora de la revisión diaria');
  if (s.weaningTrackingFrom > today) {
    throw new DomainError(
      'La fecha desde la que se sigue el destete no puede ser futura',
    );
  }
}

/**
 * Etapa del aviso de parto que corresponde a los días que faltan. Si la
 * revisión de un día no corrió (servidor apagado), al día siguiente se envía
 * la etapa pendiente: con 4 días se envía la de 5 (si no se envió antes).
 * Devuelve null si faltan más de 10 días o el parto ya pasó.
 */
export function birthAlertStage(daysLeft: number): number | null {
  if (daysLeft < 0) return null;
  const stages = [...BIRTH_ALERT_DAYS].sort((a, b) => a - b);
  return stages.find((s) => s >= daysLeft) ?? null;
}

export function birthAlertTitle(daysLeft: number): string {
  if (daysLeft === 0) return 'Parto probable hoy';
  if (daysLeft === 1) return 'Parto probable mañana';
  return `Parto probable en ${daysLeft} días`;
}

/** Justificación de un control que no se hizo en su fecha. */
export interface ControlJustificationInput {
  type: ControlType;
  reason: string;
  /**
   * Nueva fecha del control. Obligatoria en peso y sanidad (se reprograma).
   * En el destete puede faltar: el animal no se destetará o ya se destetó sin
   * registro, y el control se cierra.
   */
  nextDueDate: string | null;
}

export function assertJustification(
  input: ControlJustificationInput,
  today: string,
): void {
  if (input.reason.trim().length < 5) {
    throw new DomainError('Explique el motivo (al menos 5 caracteres)');
  }
  if (input.nextDueDate === null) {
    if (input.type !== ControlType.WEANING) {
      throw new DomainError(
        'Indique la nueva fecha del control: el control de peso y el sanitario se reprograman',
      );
    }
    return;
  }
  if (input.nextDueDate <= today) {
    throw new DomainError(
      'La nueva fecha del control debe ser posterior a hoy',
    );
  }
  if (input.nextDueDate > addDays(today, 366)) {
    throw new DomainError(
      'La nueva fecha del control no puede estar a más de un año',
    );
  }
}

export type ControlState = 'OVERDUE' | 'TODAY' | 'UPCOMING' | 'LATER';

export function controlState(
  dueDate: string,
  today: string,
  upcomingDays: number,
): ControlState {
  if (dueDate < today) return 'OVERDUE';
  if (dueDate === today) return 'TODAY';
  if (dueDate <= addDays(today, upcomingDays)) return 'UPCOMING';
  return 'LATER';
}
