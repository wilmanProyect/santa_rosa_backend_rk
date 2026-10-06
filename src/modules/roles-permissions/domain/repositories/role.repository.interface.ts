import { Role } from '../models/role.model';
import { Permission } from '../models/permission.model';

export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  findAll(): Promise<Role[]>;
  save(role: Role): Promise<void>;
  delete(id: string): Promise<void>;
  
  findPermissionsByIds(ids: string[]): Promise<Permission[]>;
  findAllPermissions(): Promise<Permission[]>;
  savePermission(permission: Permission): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('IRoleRepository');
