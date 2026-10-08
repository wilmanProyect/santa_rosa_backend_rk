import { Permission } from '@modules/roles-permissions/domain/models/permission.model';
import { PermissionEffect } from '../enums/permission-effect.enum';

export interface PermissionOverride {
  permission: Permission;
  effect: PermissionEffect;
}
