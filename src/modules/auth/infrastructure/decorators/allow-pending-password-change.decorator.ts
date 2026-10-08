import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY =
  'auth:allowPendingPasswordChange';

/**
 * Permite usar el endpoint aunque el usuario deba cambiar su contraseña
 * (p. ej. el propio cambio de contraseña, ver perfil o cerrar sesión).
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
