import { Injectable, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { ROLE_REPOSITORY } from '../../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../../domain/repositories/role.repository.interface';
import { Permission } from '../../../domain/models/permission.model';
import { UUID } from '@shared/domain/value-objects/uuid.vo';

@Injectable()
export class PermissionSeeder implements OnApplicationBootstrap {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async onApplicationBootstrap() {
    const defaultPermissions = [
      { name: 'users:create', description: 'Permite crear nuevos usuarios' },
      { name: 'users:read', description: 'Permite ver los usuarios y sus detalles' },
      { name: 'users:update', description: 'Permite actualizar la información de los usuarios' },
      { name: 'users:delete', description: 'Permite desactivar o eliminar usuarios' },
      { name: 'roles:create', description: 'Permite crear nuevos roles' },
      { name: 'roles:read', description: 'Permite ver la lista de roles y permisos' },
      { name: 'roles:update', description: 'Permite actualizar roles y sus permisos asociados' },
      { name: 'roles:delete', description: 'Permite eliminar roles' },
    ];

    const existingPermissions = await this.roleRepository.findAllPermissions();
    const existingNames = new Set(existingPermissions.map(p => p.getName()));

    for (const p of defaultPermissions) {
      if (!existingNames.has(p.name)) {
        const id = new UUID().getValue();
        const permission = new Permission(id, p.name, p.description);
        await this.roleRepository.savePermission(permission);
        console.log(`🌱 Seeded permission: ${p.name}`);
      }
    }
  }
}
