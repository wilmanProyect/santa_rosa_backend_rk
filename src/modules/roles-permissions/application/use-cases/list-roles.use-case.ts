import { Inject, Injectable } from '@nestjs/common';
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository.interface';
import type {
  IRoleRepository,
  RoleFilters,
} from '../../domain/repositories/role.repository.interface';
import { Role } from '../../domain/models/role.model';

@Injectable()
export class ListRolesUseCase {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(filters: RoleFilters): Promise<Role[]> {
    return this.roleRepository.findAll(filters);
  }
}
