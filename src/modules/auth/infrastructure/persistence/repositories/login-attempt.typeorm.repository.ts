import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import {
  ILoginAttemptRepository,
  LoginAttemptFilters,
} from '../../../domain/repositories/login-attempt.repository.interface';
import { LoginAttempt } from '../../../domain/models/login-attempt.model';
import { LoginAttemptOrmEntity } from '../entities/login-attempt.orm-entity';
import { AuthMapper } from '../mappers/auth.mapper';

@Injectable()
export class LoginAttemptTypeormRepository implements ILoginAttemptRepository {
  constructor(
    @InjectRepository(LoginAttemptOrmEntity)
    private readonly repository: Repository<LoginAttemptOrmEntity>,
  ) {}

  async save(attempt: LoginAttempt): Promise<void> {
    await this.repository.insert(AuthMapper.loginAttemptToOrm(attempt));
  }

  async findPaginated(
    filters: LoginAttemptFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<LoginAttempt>> {
    const where: FindOptionsWhere<LoginAttemptOrmEntity> = {};
    if (filters.userId !== undefined) where.userId = filters.userId;
    if (filters.success !== undefined) where.success = filters.success;

    const [entities, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return {
      items: entities.map((entity) => AuthMapper.loginAttemptToDomain(entity)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }
}
