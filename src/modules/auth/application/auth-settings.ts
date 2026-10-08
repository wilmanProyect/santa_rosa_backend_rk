export interface AuthSettings {
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  /** Intentos fallidos seguidos antes de bloquear la cuenta. */
  maxFailedAttempts: number;
  /** Minutos que dura el bloqueo. */
  lockMinutes: number;
}

export const AUTH_SETTINGS = Symbol('AuthSettings');
