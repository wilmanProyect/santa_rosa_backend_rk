import { AreaMapper } from '@modules/areas/infrastructure/persistence/mappers/area.mapper';
import { Role } from '../../../domain/models/role.model';
import { Permission } from '../../../domain/models/permission.model';
import { RoleOrmEntity } from '../entities/role.orm-entity';
import { PermissionOrmEntity } from '../entities/permission.orm-entity';

export class RoleMapper {
  static toDomain(ormEntity: RoleOrmEntity): Role {
    return new Role({
      id: ormEntity.id,
      name: ormEntity.name,
      description: ormEntity.description || '',
      area: ormEntity.area ? AreaMapper.toDomain(ormEntity.area) : null,
      isActive: ormEntity.isActive,
      isSystem: ormEntity.isSystem,
      permissions: (ormEntity.permissions || []).map((p) =>
        this.permissionToDomain(p),
      ),
      audit: {
        createdAt: ormEntity.createdAt,
        createdBy: ormEntity.createdBy,
        updatedAt: ormEntity.updatedAt,
        updatedBy: ormEntity.updatedBy,
      },
    });
  }

  static toOrm(domainModel: Role): RoleOrmEntity {
    const audit = domainModel.getAudit();
    const ormEntity = new RoleOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.name = domainModel.getName();
    ormEntity.description = domainModel.getDescription();
    ormEntity.area = AreaMapper.toReference(domainModel.getArea());
    ormEntity.isActive = domainModel.getIsActive();
    ormEntity.isSystem = domainModel.getIsSystem();
    ormEntity.permissions = domainModel
      .getPermissions()
      .map((p) => this.permissionReference(p));
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }

  /** Referencia mínima (solo id) para guardar la relación usuario-rol sin modificar el rol. */
  static toReference(domainModel: Role): RoleOrmEntity {
    const ormEntity = new RoleOrmEntity();
    ormEntity.id = domainModel.getId();
    return ormEntity;
  }

  static permissionToDomain(ormEntity: PermissionOrmEntity): Permission {
    return new Permission(
      ormEntity.id,
      ormEntity.code,
      ormEntity.module,
      ormEntity.description || '',
    );
  }

  static permissionToOrm(domainModel: Permission): PermissionOrmEntity {
    const ormEntity = new PermissionOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.code = domainModel.getCode();
    ormEntity.module = domainModel.getModule();
    ormEntity.description = domainModel.getDescription();
    return ormEntity;
  }

  static permissionReference(domainModel: Permission): PermissionOrmEntity {
    const ormEntity = new PermissionOrmEntity();
    ormEntity.id = domainModel.getId();
    return ormEntity;
  }
}
