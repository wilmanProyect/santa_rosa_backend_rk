import { SetMetadata } from '@nestjs/common';
import type { PermissionCode } from '@modules/roles-permissions/domain/permission-catalog';

export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';

/** Exige que el usuario tenga TODOS los permisos indicados. */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
