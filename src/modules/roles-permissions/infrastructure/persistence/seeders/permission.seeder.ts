import { Injectable, Inject, Logger } from '@nestjs/common';
import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { ROLE_REPOSITORY } from '../../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../../domain/repositories/role.repository.interface';
import { Permission } from '../../../domain/models/permission.model';
import { Role } from '../../../domain/models/role.model';
import {
  PERMISSION_CATALOG,
  SYSTEM_ADMIN_ROLE_NAME,
} from '../../../domain/permission-catalog';

/**
 * Sincroniza el catálogo de permisos con la base de datos y garantiza que exista
 * el rol del sistema (Administrador) con todos los permisos.
 *
 * Lo invoca el seeder inicial del módulo de usuarios, para asegurar el orden
 * permisos → rol administrador → usuario administrador.
 */
@Injectable()
export class PermissionSeeder {
  private readonly logger = new Logger(PermissionSeeder.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  /** Devuelve el rol del sistema ya sincronizado. */
  async seed(): Promise<Role> {
    const permissions = await this.syncPermissions();
    return this.syncSystemRole(permissions);
  }

  private async syncPermissions(): Promise<Permission[]> {
    const existing = await this.roleRepository.findAllPermissions();
    const byCode = new Map(existing.map((p) => [p.getCode(), p]));
    const toSave: Permission[] = [];

    for (const definition of PERMISSION_CATALOG) {
      const current = byCode.get(definition.code);
      if (!current) {
        const permission = new Permission(
          new UUID().getValue(),
          definition.code,
          definition.module,
          definition.description,
        );
        byCode.set(definition.code, permission);
        toSave.push(permission);
        this.logger.log(`Permiso creado: ${definition.code}`);
      } else if (
        current.getModule() !== definition.module ||
        current.getDescription() !== definition.description
      ) {
        current.updateDetails(definition.module, definition.description);
        toSave.push(current);
      }
    }

    await this.roleRepository.savePermissions(toSave);

    const catalogCodes = new Set<string>(PERMISSION_CATALOG.map((d) => d.code));
    const obsolete = existing.filter((p) => !catalogCodes.has(p.getCode()));
    if (obsolete.length > 0) {
      this.logger.warn(
        `Permisos en BD que ya no existen en el catálogo: ${obsolete.map((p) => p.getCode()).join(', ')}`,
      );
    }

    return PERMISSION_CATALOG.map((d) => byCode.get(d.code)!);
  }

  private async syncSystemRole(permissions: Permission[]): Promise<Role> {
    let role = await this.roleRepository.findSystemRole();
    if (!role) {
      role = Role.create({
        name: SYSTEM_ADMIN_ROLE_NAME,
        description: 'Acceso total al sistema (rol protegido)',
        area: null,
        permissions,
        createdBy: null,
        isSystem: true,
      });
      this.logger.log(`Rol del sistema creado: ${SYSTEM_ADMIN_ROLE_NAME}`);
    } else {
      role.syncSystemPermissions(permissions);
    }
    await this.roleRepository.save(role);
    return role;
  }
}
