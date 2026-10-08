import { Role } from '../models/role.model';
import { Permission } from '../models/permission.model';

export interface RoleFilters {
  areaId?: string;
  isActive?: boolean;
}

export interface IRoleRepository {
  findById(id: string): Promise<Role | null>;
  findByIds(ids: string[]): Promise<Role[]>;
  findByName(name: string): Promise<Role | null>;
  findAll(filters: RoleFilters): Promise<Role[]>;
  findSystemRole(): Promise<Role | null>;
  save(role: Role): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
  /** Cantidad de usuarios (no eliminados) que tienen asignado el rol. */
  countAssignedUsers(roleId: string): Promise<number>;

  findPermissionsByIds(ids: string[]): Promise<Permission[]>;
  findAllPermissions(): Promise<Permission[]>;
  savePermissions(permissions: Permission[]): Promise<void>;
}

export const ROLE_REPOSITORY = Symbol('IRoleRepository');
