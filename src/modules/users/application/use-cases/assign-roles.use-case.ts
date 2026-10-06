import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { ROLE_REPOSITORY } from '@modules/roles-permissions/domain/repositories/role.repository.interface';
import type { IRoleRepository } from '@modules/roles-permissions/domain/repositories/role.repository.interface';
import { User } from '../../domain/models/user.model';
import { AssignRolesDto } from '../dtos/assign-roles.dto';

@Injectable()
export class AssignRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(userId: string, dto: AssignRolesDto): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    const roles = [];
    for (const roleId of dto.roleIds) {
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        throw new NotFoundException(`Role with ID "${roleId}" not found`);
      }
      roles.push(role);
    }

    user.assignRoles(roles);
    await this.userRepository.save(user);
    return user;
  }
}
