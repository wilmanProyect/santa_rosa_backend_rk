import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsRelations,
  FindOptionsWhere,
  ILike,
  Repository,
} from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import {
  IUserRepository,
  UserFilters,
} from '../../../domain/repositories/user.repository.interface';
import { User } from '../../../domain/models/user.model';
import { UserOrmEntity } from '../entities/user.orm-entity';
import { UserMapper } from '../mappers/user.mapper';

const USER_RELATIONS: FindOptionsRelations<UserOrmEntity> = {
  area: true,
  roles: { permissions: true, area: true },
  permissionOverrides: { permission: true },
};

const SEARCHABLE_FIELDS = [
  'firstName',
  'paternalLastName',
  'maternalLastName',
  'username',
  'ciNumber',
  'email',
] as const;

@Injectable()
export class UserTypeormRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly repository: Repository<UserOrmEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.findOneBy({ id });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.findOneBy({ username: username.trim().toLowerCase() });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOneBy({ email: email.trim().toLowerCase() });
  }

  async findByCiNumber(ciNumber: string): Promise<User | null> {
    return this.findOneBy({ ciNumber: ciNumber.trim().toUpperCase() });
  }

  async findPaginated(
    filters: UserFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<User>> {
    const base: FindOptionsWhere<UserOrmEntity> = {};
    if (filters.status !== undefined) base.status = filters.status;
    if (filters.areaId !== undefined) base.area = { id: filters.areaId };

    const search = filters.search?.trim();
    const where = search
      ? SEARCHABLE_FIELDS.map((field) => ({
          ...base,
          [field]: ILike(`%${escapeLike(search)}%`),
        }))
      : base;

    const [entities, total] = await this.repository.findAndCount({
      where,
      relations: USER_RELATIONS,
      order: { paternalLastName: 'ASC', firstName: 'ASC', id: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      items: entities.map((entity) => UserMapper.toDomain(entity)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async countActiveWithRole(roleId: string): Promise<number> {
    const rows: { total: string }[] = await this.repository.query(
      `SELECT COUNT(*) AS total
         FROM user_roles ur
         JOIN users u ON u.id = ur.user_id
        WHERE ur.role_id = $1 AND u.deleted_at IS NULL AND u.status = 'ACTIVE'`,
      [roleId],
    );
    return Number(rows[0].total);
  }

  async save(user: User): Promise<void> {
    await this.repository.save(UserMapper.toOrm(user));
  }

  async saveLoginState(user: User): Promise<void> {
    // SQL directo para no modificar updated_at: un login no es una edición del usuario.
    await this.repository.query(
      `UPDATE users
          SET failed_login_attempts = $1, locked_until = $2, last_login_at = $3
        WHERE id = $4`,
      [
        user.getFailedLoginAttempts(),
        user.getLockedUntil(),
        user.getLastLoginAt(),
        user.getId(),
      ],
    );
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  private async findOneBy(
    where: FindOptionsWhere<UserOrmEntity>,
  ): Promise<User | null> {
    const entity = await this.repository.findOne({
      where,
      relations: USER_RELATIONS,
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
