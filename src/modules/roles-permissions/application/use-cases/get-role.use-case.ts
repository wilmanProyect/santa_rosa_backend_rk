import { Injectable } from '@nestjs/common';
import { Role } from '../../domain/models/role.model';
import { RoleLookupService } from '../services/role-lookup.service';

@Injectable()
export class GetRoleUseCase {
  constructor(private readonly roleLookup: RoleLookupService) {}

  async execute(id: string): Promise<Role> {
    return this.roleLookup.getRole(id);
  }
}
