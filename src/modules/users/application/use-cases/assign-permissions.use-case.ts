import { Inject, Injectable } from '@nestjs/common';
import { RoleLookupService } from '@modules/roles-permissions/application/services/role-lookup.service';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/models/user.model';
import { PermissionEffect } from '../../domain/enums/permission-effect.enum';
import { AssignPermissionsDto } from '../dtos/assign-permissions.dto';
import { GetUserUseCase } from './get-user.use-case';

@Injectable()
export class AssignPermissionsUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly roleLookup: RoleLookupService,
  ) {}

  async execute(
    actorId: string,
    userId: string,
    dto: AssignPermissionsDto,
  ): Promise<User> {
    const user = await this.getUserUseCase.execute(userId);
    const granted = await this.roleLookup.resolvePermissions(
      dto.grantedPermissionIds,
    );
    const denied = await this.roleLookup.resolvePermissions(
      dto.deniedPermissionIds,
    );

    user.setPermissionOverrides([
      ...granted.map((permission) => ({
        permission,
        effect: PermissionEffect.GRANT,
      })),
      ...denied.map((permission) => ({
        permission,
        effect: PermissionEffect.DENY,
      })),
    ]);

    user.markUpdatedBy(actorId);
    await this.userRepository.save(user);
    return user;
  }
}
