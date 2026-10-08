import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { GetAreaUseCase } from '@modules/areas/application/use-cases/get-area.use-case';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/models/role.model';
import { UpdateRoleDto } from '../dtos/update-role.dto';
import { RoleLookupService } from '../services/role-lookup.service';

@Injectable()
export class UpdateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly roleLookup: RoleLookupService,
    private readonly getAreaUseCase: GetAreaUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.roleLookup.getRole(id);

    if (dto.name !== undefined && dto.name.trim() !== role.getName()) {
      const existingRole = await this.roleRepository.findByName(
        dto.name.trim(),
      );
      if (existingRole && existingRole.getId() !== id) {
        throw new ConflictException(
          `Ya existe un rol con el nombre "${dto.name}"`,
        );
      }
      role.rename(dto.name);
    }

    if (dto.description !== undefined) {
      role.updateDescription(dto.description);
    }

    if (dto.areaId !== undefined) {
      const area = dto.areaId
        ? await this.getAreaUseCase.executeActive(dto.areaId)
        : null;
      role.assignArea(area);
    }

    if (dto.isActive === true) {
      role.activate();
    } else if (dto.isActive === false) {
      role.deactivate();
    }

    if (dto.permissionIds !== undefined) {
      const permissions = await this.roleLookup.resolvePermissions(
        dto.permissionIds,
      );
      role.updatePermissions(permissions);
    }

    role.markUpdatedBy(actorId);
    await this.roleRepository.save(role);
    return role;
  }
}
