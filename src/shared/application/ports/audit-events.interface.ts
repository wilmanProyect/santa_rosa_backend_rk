/**
 * Acciones que no son altas ni modificaciones de datos y se registran en el
 * historial de actividad (los cambios de datos los registra la base de datos).
 */
export const AUDIT_EVENTS = Symbol('AUDIT_EVENTS');

export enum AuditEventType {
  CERTIFICATE_ISSUED = 'CERTIFICATE_ISSUED',
  BACKUP_DOWNLOADED = 'BACKUP_DOWNLOADED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  ANIMALS_IMPORTED = 'ANIMALS_IMPORTED',
}

export interface AuditEvent {
  event: AuditEventType;
  /** Tabla del registro afectado (animals, ...) o "system". */
  entity: string;
  recordId?: string | null;
  animalIds?: string[];
  /** Descripción para el historial (máximo 300 caracteres). */
  summary: string;
  details?: Record<string, unknown>;
}

export interface IAuditEvents {
  /** Usa el usuario y la IP de la petición en curso. Nunca lanza: un fallo se registra en el log. */
  record(event: AuditEvent): Promise<void>;
}
