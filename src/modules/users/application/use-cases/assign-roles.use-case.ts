import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { RoleLookupService } from '@modules/roles-permissions/application/services/role-lookup.service';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/models/user.model';
import { AssignRolesDto } from '../dtos/assign-roles.dto';
import { GetUserUseCase } from './get-user.use-case';

@Injectable()
export class AssignRolesUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly roleLookup: RoleLookupService,
  ) {}

  async execute(
    actorId: string,
    userId: string,
    dto: AssignRolesDto,
  ): Promise<User> {
    const user = await this.getUserUseCase.execute(userId);
    const roles = await this.roleLookup.resolveAssignableRoles(dto.roleIds);

    // Evita que un administrador se quite a sí mismo el acceso total por error.
    const keepsSystemRole = roles.some((r) => r.getIsSystem());
    if (userId === actorId && user.hasSystemRole() && !keepsSystemRole) {
      throw new BadRequestException(
        'No puede quitarse a sí mismo el rol de Administrador',
      );
    }

    user.assignRoles(roles);
    user.markUpdatedBy(actorId);
    await this.userRepository.save(user);
    return user;
  }
}
