/** Ajuste individual de un permiso sobre lo que el usuario hereda de sus roles. */
export enum PermissionEffect {
  /** Otorga el permiso aunque ningún rol lo tenga. */
  GRANT = 'GRANT',
  /** Quita el permiso aunque algún rol lo tenga (tiene prioridad). */
  DENY = 'DENY',
}
