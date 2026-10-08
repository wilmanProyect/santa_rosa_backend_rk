import { RoleMapper } from '@modules/roles-permissions/infrastructure/persistence/mappers/role.mapper';
import { AreaMapper } from '@modules/areas/infrastructure/persistence/mappers/area.mapper';
import { User } from '../../../domain/models/user.model';
import { Email } from '../../../domain/value-objects/email.vo';
import { Password } from '../../../domain/value-objects/password.vo';
import { Username } from '../../../domain/value-objects/username.vo';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserPermissionOrmEntity } from '../entities/user-permission.orm-entity';

export class UserMapper {
  static toDomain(ormEntity: UserOrmEntity): User {
    return new User({
      id: ormEntity.id,
      firstName: ormEntity.firstName,
      paternalLastName: ormEntity.paternalLastName,
      maternalLastName: ormEntity.maternalLastName,
      ciNumber: ormEntity.ciNumber,
      username: new Username(ormEntity.username),
      email: ormEntity.email ? new Email(ormEntity.email) : null,
      password: new Password(ormEntity.passwordHash),
      birthDate: ormEntity.birthDate,
      phone: ormEntity.phone,
      position: ormEntity.position,
      area: ormEntity.area ? AreaMapper.toDomain(ormEntity.area) : null,
      status: ormEntity.status,
      inactiveReason: ormEntity.inactiveReason,
      inactiveDate: ormEntity.inactiveDate,
      inactiveNotes: ormEntity.inactiveNotes,
      mustChangePassword: ormEntity.mustChangePassword,
      passwordChangedAt: ormEntity.passwordChangedAt,
      failedLoginAttempts: ormEntity.failedLoginAttempts,
      lockedUntil: ormEntity.lockedUntil,
      lastLoginAt: ormEntity.lastLoginAt,
      roles: (ormEntity.roles || []).map((r) => RoleMapper.toDomain(r)),
      permissionOverrides: (ormEntity.permissionOverrides || []).map((o) => ({
        permission: RoleMapper.permissionToDomain(o.permission),
        effect: o.effect,
      })),
      audit: {
        createdAt: ormEntity.createdAt,
        createdBy: ormEntity.createdBy,
        updatedAt: ormEntity.updatedAt,
        updatedBy: ormEntity.updatedBy,
      },
    });
  }

  static toOrm(domainModel: User): UserOrmEntity {
    const audit = domainModel.getAudit();
    const ormEntity = new UserOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.firstName = domainModel.getFirstName();
    ormEntity.paternalLastName = domainModel.getPaternalLastName();
    ormEntity.maternalLastName = domainModel.getMaternalLastName();
    ormEntity.ciNumber = domainModel.getCiNumber();
    ormEntity.username = domainModel.getUsername().getValue();
    ormEntity.email = domainModel.getEmail()?.getValue() ?? null;
    ormEntity.passwordHash = domainModel.getPassword().getHash();
    ormEntity.birthDate = domainModel.getBirthDate();
    ormEntity.phone = domainModel.getPhone();
    ormEntity.position = domainModel.getPosition();
    ormEntity.area = AreaMapper.toReference(domainModel.getArea());
    ormEntity.status = domainModel.getStatus();
    ormEntity.inactiveReason = domainModel.getInactiveReason();
    ormEntity.inactiveDate = domainModel.getInactiveDate();
    ormEntity.inactiveNotes = domainModel.getInactiveNotes();
    ormEntity.mustChangePassword = domainModel.getMustChangePassword();
    ormEntity.passwordChangedAt = domainModel.getPasswordChangedAt();
    ormEntity.failedLoginAttempts = domainModel.getFailedLoginAttempts();
    ormEntity.lockedUntil = domainModel.getLockedUntil();
    ormEntity.lastLoginAt = domainModel.getLastLoginAt();
    ormEntity.roles = domainModel
      .getRoles()
      .map((r) => RoleMapper.toReference(r));
    ormEntity.permissionOverrides = domainModel
      .getPermissionOverrides()
      .map((o) => {
        const override = new UserPermissionOrmEntity();
        override.userId = domainModel.getId();
        override.permissionId = o.permission.getId();
        override.effect = o.effect;
        return override;
      });
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }
}
