export enum LoginFailureReason {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  USER_INACTIVE = 'USER_INACTIVE',
}

export enum SessionRevokedReason {
  /** El usuario cerró sesión. */
  LOGOUT = 'LOGOUT',
  /** El refresh token se usó y se reemplazó por uno nuevo. */
  ROTATED = 'ROTATED',
  /** El usuario cambió su contraseña. */
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  /** Se reutilizó un refresh token ya rotado (posible robo): se cierran todas las sesiones. */
  REUSE_DETECTED = 'REUSE_DETECTED',
  /** El usuario ya no puede usar la sesión (baja, contraseña restablecida, etc.). */
  INVALIDATED = 'INVALIDATED',
}
