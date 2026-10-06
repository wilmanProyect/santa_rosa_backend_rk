import { User } from '../../../domain/models/user.model';
import { Email } from '../../../domain/value-objects/email.vo';
import { Password } from '../../../domain/value-objects/password.vo';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { RoleMapper } from '@modules/roles-permissions/infrastructure/persistence/mappers/role.mapper';

export class UserMapper {
  static toDomain(ormEntity: UserOrmEntity): User {
    const roles = (ormEntity.roles || []).map(r => RoleMapper.toDomain(r));
    return new User(
      ormEntity.id,
      ormEntity.name,
      new Email(ormEntity.email),
      new Password(ormEntity.passwordHash),
      ormEntity.isActive,
      roles,
    );
  }

  static toOrm(domainModel: User): UserOrmEntity {
    const ormEntity = new UserOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.name = domainModel.getName();
    ormEntity.email = domainModel.getEmail().getValue();
    ormEntity.passwordHash = domainModel.getPassword().getHash();
    ormEntity.isActive = domainModel.getIsActive();
    ormEntity.roles = (domainModel.getRoles() || []).map(r => RoleMapper.toOrm(r));
    return ormEntity;
  }
}
