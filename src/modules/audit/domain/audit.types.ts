import { AuditEventType } from '@shared/application/ports/audit-events.interface';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  RESTORE = 'RESTORE',
  EVENT = 'EVENT',
}

export enum AuditSource {
  /** Petición de un usuario a la API. */
  API = 'API',
  /** Tareas automáticas, migraciones o comandos de terminal. */
  SYSTEM = 'SYSTEM',
}

/** Tablas registradas (las del trigger audit_capture) y su nombre en pantalla. */
export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  animals: 'Animal',
  animal_photos: 'Foto del animal',
  animal_weighings: 'Pesaje',
  health_records: 'Registro sanitario',
  genetic_category_changes: 'Cambio de categoría genética',
  control_justifications: 'Justificación de control',
  breeding_services: 'Monta',
  pregnancy_checks: 'Diagnóstico de preñez',
  births: 'Parto',
  birth_offspring: 'Cría del parto',
  areas: 'Área',
  breeds: 'Raza',
  animal_colors: 'Color',
  veterinary_products: 'Producto veterinario',
  roles: 'Rol',
  role_permissions: 'Permiso del rol',
  users: 'Usuario',
  user_roles: 'Rol del usuario',
  user_permissions: 'Permiso individual del usuario',
  data_reviews: 'Revisión de datos',
  data_review_targets: 'Registro en revisión',
  notification_settings: 'Configuración de notificaciones',
  system: 'Sistema',
};

export const AUDIT_EVENT_LABELS: Record<AuditEventType, string> = {
  [AuditEventType.CERTIFICATE_ISSUED]: 'Emitió el certificado',
  [AuditEventType.BACKUP_DOWNLOADED]: 'Descargó una copia de seguridad',
  [AuditEventType.BACKUP_RESTORED]: 'Restauró una copia de seguridad',
  [AuditEventType.ANIMALS_IMPORTED]: 'Importó animales desde planillas',
};

export interface AuditFilters {
  userId?: string;
  entity?: string;
  recordId?: string;
  animalId?: string;
  action?: AuditAction;
  event?: AuditEventType;
  source?: AuditSource;
  requestId?: string;
  /** YYYY-MM-DD, en la zona horaria de la cabaña (incluido). */
  from?: string;
  /** YYYY-MM-DD, en la zona horaria de la cabaña (incluido). */
  to?: string;
}

/**
 * Cambios registrados:
 * - CREATE y DELETE: `{ campo: valor }` (los datos ingresados o los del registro borrado);
 * - UPDATE: `{ campo: [anterior, nuevo] }`, solo los campos que cambiaron;
 * - EVENT: detalles de la acción.
 * Los campos secretos aparecen como "[oculto]".
 */
export type AuditChanges = Record<string, unknown>;

export interface AuditEntry {
  id: string;
  occurredAt: Date;
  actorId: string | null;
  actorUsername: string | null;
  actorFullName: string | null;
  requestId: string | null;
  ip: string | null;
  source: AuditSource;
  action: AuditAction;
  entity: string;
  recordId: string | null;
  animalIds: string[];
  changes: AuditChanges | null;
  event: AuditEventType | null;
  summary: string | null;
}

export interface AuditRef {
  type:
    | 'animal'
    | 'breed'
    | 'color'
    | 'area'
    | 'product'
    | 'role'
    | 'permission'
    | 'user';
  label: string;
}
