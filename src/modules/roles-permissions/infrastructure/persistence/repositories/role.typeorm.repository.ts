import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsRelations,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import {
  IRoleRepository,
  RoleFilters,
} from '../../../domain/repositories/role.repository.interface';
import { Role } from '../../../domain/models/role.model';
import { Permission } from '../../../domain/models/permission.model';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';
import { RoleMapper } from '../mappers/role.mapper';

const ROLE_RELATIONS: FindOptionsRelations<RoleOrmEntity> = {
  permissions: true,
  area: true,
};

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
      relations: ROLE_RELATIONS,
    });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findByIds(ids: string[]): Promise<Role[]> {
    if (ids.length === 0) return [];
    const entities = await this.roleRepository.find({
      where: { id: In(ids) },
      relations: ROLE_RELATIONS,
    });
    return entities.map((entity) => RoleMapper.toDomain(entity));
  }

  async findByName(name: string): Promise<Role | null> {
    const entity = await this.roleRepository.findOne({
      where: { name },
      relations: ROLE_RELATIONS,
    });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async findAll(filters: RoleFilters): Promise<Role[]> {
    const where: FindOptionsWhere<RoleOrmEntity> = {};
    if (filters.areaId !== undefined) where.area = { id: filters.areaId };
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const entities = await this.roleRepository.find({
      where,
      relations: ROLE_RELATIONS,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => RoleMapper.toDomain(entity));
  }

  async findSystemRole(): Promise<Role | null> {
    const entity = await this.roleRepository.findOne({
      where: { isSystem: true },
      relations: ROLE_RELATIONS,
    });
    return entity ? RoleMapper.toDomain(entity) : null;
  }

  async save(role: Role): Promise<void> {
    await this.roleRepository.save(RoleMapper.toOrm(role));
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.roleRepository.update({ id }, { updatedBy: actorId });
    await this.roleRepository.softDelete({ id });
  }

  async countAssignedUsers(roleId: string): Promise<number> {
    const rows: { total: string }[] = await this.roleRepository.query(
      `SELECT COUNT(*) AS total
         FROM user_roles ur
         JOIN users u ON u.id = ur.user_id
        WHERE ur.role_id = $1 AND u.deleted_at IS NULL`,
      [roleId],
    );
    return Number(rows[0].total);
  }

  async findPermissionsByIds(ids: string[]): Promise<Permission[]> {
    if (ids.length === 0) return [];
    const entities = await this.permissionRepository.find({
      where: { id: In(ids) },
    });
    return entities.map((entity) => RoleMapper.permissionToDomain(entity));
  }

  async findAllPermissions(): Promise<Permission[]> {
    const entities = await this.permissionRepository.find({
      order: { module: 'ASC', code: 'ASC' },
    });
    return entities.map((entity) => RoleMapper.permissionToDomain(entity));
  }

  async savePermissions(permissions: Permission[]): Promise<void> {
    if (permissions.length === 0) return;
    await this.permissionRepository.save(
      permissions.map((p) => RoleMapper.permissionToOrm(p)),
    );
  }
}
