import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IRoleRepository } from '../../../domain/repositories/role.repository.interface';
import { Role } from '../../../domain/models/role.model';
import { Permission } from '../../../domain/models/permission.model';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';
import { RoleMapper } from '../mappers/role.mapper';

@Injectable()
export class RoleTypeormRepository implements IRoleRepository {
  constructor(
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepository: Repository<RoleOrmEntity>,
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepository: Repository<PermissionOrmEntity>,
  ) {}

  async findById(id: string): Promise<Role | null> {
    const entity = await this.roleRepository.findOne({
      where: { id },
      relations: { permissions: true },
    });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<Role | null> {
    const entity = await this.roleRepository.findOne({
      where: { name },
      relations: { permissions: true },
    });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findAll(): Promise<Role[]> {
    const entities = await this.roleRepository.find({
      relations: { permissions: true },
    });
    return entities.map(entity => RoleMapper.toDomain(entity));
  }

  async save(role: Role): Promise<void> {
    const ormEntity = RoleMapper.toOrm(role);
    await this.roleRepository.save(ormEntity);
  }

  async delete(id: string): Promise<void> {
    await this.roleRepository.delete(id);
  }

  async findPermissionsByIds(ids: string[]): Promise<Permission[]> {
    if (!ids || ids.length === 0) return [];
    const entities = await this.permissionRepository.find({
      where: { id: In(ids) },
    });
    return entities.map(entity => RoleMapper.permissionToDomain(entity));
  }

  async findAllPermissions(): Promise<Permission[]> {
    const entities = await this.permissionRepository.find();
    return entities.map(entity => RoleMapper.permissionToDomain(entity));
  }

  async savePermission(permission: Permission): Promise<void> {
    const ormEntity = RoleMapper.permissionToOrm(permission);
    await this.permissionRepository.save(ormEntity);
  }
}
