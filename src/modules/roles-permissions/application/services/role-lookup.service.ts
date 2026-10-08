import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unique } from '@shared/application/unique';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/models/role.model';
import { Permission } from '../../domain/models/permission.model';

/**
 * Resuelve listas de IDs de roles/permisos recibidas por la API,
 * ignorando duplicados y fallando si alguno no existe.
 */
@Injectable()
export class RoleLookupService {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async getRole(id: string): Promise<Role> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`No se encontró el rol con ID "${id}"`);
    }
    return role;
  }

  async resolvePermissions(ids: string[]): Promise<Permission[]> {
    const uniqueIds = unique(ids);
    if (uniqueIds.length === 0) return [];

    const permissions =
      await this.roleRepository.findPermissionsByIds(uniqueIds);
    const found = new Set(permissions.map((p) => p.getId()));
    const missing = uniqueIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `No se encontraron los permisos: ${missing.join(', ')}`,
      );
    }
    return permissions;
  }

  /** Resuelve roles para asignarlos a un usuario: deben existir y estar activos. */
  async resolveAssignableRoles(ids: string[]): Promise<Role[]> {
    const uniqueIds = unique(ids);
    if (uniqueIds.length === 0) return [];

    const roles = await this.roleRepository.findByIds(uniqueIds);
    const found = new Set(roles.map((r) => r.getId()));
    const missing = uniqueIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new NotFoundException(
        `No se encontraron los roles: ${missing.join(', ')}`,
      );
    }

    const inactive = roles.filter((r) => !r.getIsActive());
    if (inactive.length > 0) {
      throw new BadRequestException(
        `No se pueden asignar roles inactivos: ${inactive.map((r) => r.getName()).join(', ')}`,
      );
    }
    return roles;
  }
}
