/** Usuario autenticado de la petición actual (lo adjunta el JwtAuthGuard). */
export interface AuthenticatedUser {
  id: string;
  username: string;
  sessionId: string;
  /** Permisos efectivos (roles + ajustes individuales). */
  permissions: string[];
  mustChangePassword: boolean;
}

/** Datos del cliente que origina la petición, para auditoría. */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}
