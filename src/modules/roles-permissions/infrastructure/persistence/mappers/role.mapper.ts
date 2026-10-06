import { Role } from '../../../domain/models/role.model';
import { Permission } from '../../../domain/models/permission.model';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';

export class RoleMapper {
  static toDomain(ormEntity: RoleOrmEntity): Role {
    const permissions = (ormEntity.permissions || []).map(p => this.permissionToDomain(p));
    return new Role(
      ormEntity.id,
      ormEntity.name,
      ormEntity.description || '',
      permissions,
    );
  }

  static toOrm(domainModel: Role): RoleOrmEntity {
    const ormEntity = new RoleOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.name = domainModel.getName();
    ormEntity.description = domainModel.getDescription();
    ormEntity.permissions = (domainModel.getPermissions() || []).map(p => this.permissionToOrm(p));
    return ormEntity;
  }

  static permissionToDomain(ormEntity: PermissionOrmEntity): Permission {
    return new Permission(
      ormEntity.id,
      ormEntity.name,
      ormEntity.description || '',
    );
  }

  static permissionToOrm(domainModel: Permission): PermissionOrmEntity {
    const ormEntity = new PermissionOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.name = domainModel.getName();
    ormEntity.description = domainModel.getDescription();
    return ormEntity;
  }
}
