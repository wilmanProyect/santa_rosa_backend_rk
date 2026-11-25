import { AsyncLocalStorage } from 'async_hooks';

/**
 * Datos de la petición en curso que se guardan en el registro de actividad.
 * Fuera de una petición HTTP (tareas programadas, terminal) no hay contexto y
 * los cambios se registran como SYSTEM, sin usuario.
 */
export interface AuditContext {
  actorId: string | null;
  requestId: string;
  ip: string | null;
}

export const auditContextStorage = new AsyncLocalStorage<AuditContext>();

export const currentAuditContext = (): AuditContext | undefined =>
  auditContextStorage.getStore();
