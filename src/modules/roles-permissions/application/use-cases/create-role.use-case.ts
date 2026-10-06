import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/models/role.model';
import { Permission } from '../../domain/models/permission.model';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { UUID } from '@shared/domain/value-objects/uuid.vo';

@Injectable()
export class CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(dto: CreateRoleDto): Promise<Role> {
    const existingRole = await this.roleRepository.findByName(dto.name);
    if (existingRole) {
      throw new ConflictException(`Role with name "${dto.name}" already exists`);
    }

    let permissions: Permission[] = [];
    if (dto.permissionIds && dto.permissionIds.length > 0) {
      permissions = await this.roleRepository.findPermissionsByIds(dto.permissionIds);
      if (permissions.length !== dto.permissionIds.length) {
        throw new NotFoundException('One or more permission IDs were not found');
      }
    }

    const roleId = new UUID().getValue();
    const role = new Role(
      roleId,
      dto.name,
      dto.description || '',
      permissions,
    );

    await this.roleRepository.save(role);
    return role;
  }
}
