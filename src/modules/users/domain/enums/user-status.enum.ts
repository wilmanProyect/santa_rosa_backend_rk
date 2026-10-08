export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/** Motivo por el que un usuario fue dado de baja. */
export enum InactiveReason {
  /** Renuncia voluntaria */
  RESIGNATION = 'RESIGNATION',
  /** Despido */
  DISMISSAL = 'DISMISSAL',
  /** Baja médica */
  MEDICAL_LEAVE = 'MEDICAL_LEAVE',
  /** Suspensión temporal */
  SUSPENSION = 'SUSPENSION',
  /** Otro motivo (detallar en observaciones) */
  OTHER = 'OTHER',
}
