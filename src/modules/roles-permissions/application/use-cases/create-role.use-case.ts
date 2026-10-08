import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { GetAreaUseCase } from '@modules/areas/application/use-cases/get-area.use-case';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type { IRoleRepository } from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/models/role.model';
import { CreateRoleDto } from '../dtos/create-role.dto';
import { RoleLookupService } from '../services/role-lookup.service';

@Injectable()
export class CreateRoleUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly roleLookup: RoleLookupService,
    private readonly getAreaUseCase: GetAreaUseCase,
  ) {}

  async execute(actorId: string, dto: CreateRoleDto): Promise<Role> {
    const existingRole = await this.roleRepository.findByName(dto.name.trim());
    if (existingRole) {
      throw new ConflictException(
        `Ya existe un rol con el nombre "${dto.name}"`,
      );
    }

    const area = dto.areaId
      ? await this.getAreaUseCase.executeActive(dto.areaId)
      : null;
    const permissions = await this.roleLookup.resolvePermissions(
      dto.permissionIds ?? [],
    );

    const role = Role.create({
      name: dto.name,
      description: dto.description,
      area,
      permissions,
      createdBy: actorId,
    });

    await this.roleRepository.save(role);
    return role;
  }
}
