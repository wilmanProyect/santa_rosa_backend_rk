import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { RoleLookupService } from '../services/role-lookup.service';

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly roleLookup: RoleLookupService,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    const role = await this.roleLookup.getRole(id);
    role.ensureDeletable();

    const assignedUsers = await this.roleRepository.countAssignedUsers(id);
    if (assignedUsers > 0) {
      throw new ConflictException(
        `No se puede eliminar el rol: está asignado a ${assignedUsers} usuario(s). Desactívelo o reasigne a los usuarios primero.`,
      );
    }

    await this.roleRepository.softDelete(id, actorId);
  }
}
