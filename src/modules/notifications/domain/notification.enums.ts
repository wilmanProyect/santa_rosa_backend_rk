import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import type { PermissionCode } from '@modules/roles-permissions/domain/permission-catalog';

/** Controles periódicos o únicos de cada animal. */
export enum ControlType {
  /** Destete: una vez, a los N meses de nacer (pesaje de tipo WEANING). */
  WEANING = 'WEANING',
  /** Control de peso: cada N meses desde el último pesaje. */
  WEIGHING = 'WEIGHING',
  /** Control sanitario: cada N meses desde el último registro sanitario. */
  HEALTH = 'HEALTH',
}

export enum NotificationType {
  /** Parto probable a 10, 5, 2, 1 o 0 días. */
  BIRTH_UPCOMING = 'BIRTH_UPCOMING',
  /** Resumen de destetes (próximos, de hoy, atrasados). */
  WEANING_DUE = 'WEANING_DUE',
  /** Resumen de controles de peso. */
  WEIGHING_DUE = 'WEIGHING_DUE',
  /** Resumen de controles sanitarios. */
  HEALTH_DUE = 'HEALTH_DUE',
}

/** A qué pantalla lleva la notificación (el frontend arma la ruta). */
export enum NotificationTarget {
  /** target_id = id de la monta. */
  BREEDING_SERVICE = 'BREEDING_SERVICE',
  /** target_id = null; la pantalla de controles filtrada por el tipo. */
  CONTROLS = 'CONTROLS',
}

/** Días antes del parto probable en que se avisa (0 = el día del parto). */
export const BIRTH_ALERT_DAYS = [10, 5, 2, 1, 0] as const;

/** Quién recibe cada tipo de aviso: los usuarios activos con este permiso. */
export const NOTIFICATION_PERMISSION: Record<NotificationType, PermissionCode> =
  {
    [NotificationType.BIRTH_UPCOMING]: PERMISSIONS.REPRODUCTION_READ,
    [NotificationType.WEANING_DUE]: PERMISSIONS.WEIGHINGS_WRITE,
    [NotificationType.WEIGHING_DUE]: PERMISSIONS.WEIGHINGS_WRITE,
    [NotificationType.HEALTH_DUE]: PERMISSIONS.HEALTH_WRITE,
  };

/** Permiso para ver y justificar cada tipo de control. */
export const CONTROL_PERMISSION: Record<ControlType, PermissionCode> = {
  [ControlType.WEANING]: PERMISSIONS.WEIGHINGS_WRITE,
  [ControlType.WEIGHING]: PERMISSIONS.WEIGHINGS_WRITE,
  [ControlType.HEALTH]: PERMISSIONS.HEALTH_WRITE,
};

export const CONTROL_NOTIFICATION: Record<ControlType, NotificationType> = {
  [ControlType.WEANING]: NotificationType.WEANING_DUE,
  [ControlType.WEIGHING]: NotificationType.WEIGHING_DUE,
  [ControlType.HEALTH]: NotificationType.HEALTH_DUE,
};

export const CONTROL_LABEL: Record<ControlType, string> = {
  [ControlType.WEANING]: 'Destete',
  [ControlType.WEIGHING]: 'Control de peso',
  [ControlType.HEALTH]: 'Control sanitario',
};
