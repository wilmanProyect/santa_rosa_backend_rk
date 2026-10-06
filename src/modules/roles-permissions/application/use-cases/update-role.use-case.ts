import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/models/role.model';
import { Permission } from '../../domain/models/permission.model';
import { UpdateRoleDto } from '../dtos/update-role.dto';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleRepository.findById(id);
    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }

    if (dto.name) {
      const existingRoleName = await this.roleRepository.findByName(dto.name);
      if (existingRoleName && existingRoleName.getId() !== id) {
        throw new ConflictException(`Role with name "${dto.name}" already exists`);
      }
      role.updateName(dto.name);
    }

    if (dto.description !== undefined) {
      role.updateDescription(dto.description);
    }

    if (dto.permissionIds) {
      let permissions: Permission[] = [];
      if (dto.permissionIds.length > 0) {
        permissions = await this.roleRepository.findPermissionsByIds(dto.permissionIds);
        if (permissions.length !== dto.permissionIds.length) {
          throw new NotFoundException('One or more permission IDs were not found');
        }
      }
      role.updatePermissions(permissions);
    }

    await this.roleRepository.save(role);
    return role;
  }
}
