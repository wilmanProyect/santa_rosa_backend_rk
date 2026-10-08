import { Inject, Injectable } from '@nestjs/common';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { LOGIN_ATTEMPT_REPOSITORY } from '../../domain/repositories/login-attempt.repository.interface';
import type {
  ILoginAttemptRepository,
  LoginAttemptFilters,
} from '../../domain/repositories/login-attempt.repository.interface';
import { LoginAttempt } from '../../domain/models/login-attempt.model';

@Injectable()
export class ListLoginHistoryUseCase {
  constructor(
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly loginAttemptRepository: ILoginAttemptRepository,
  ) {}

  async execute(
    filters: LoginAttemptFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<LoginAttempt>> {
    return this.loginAttemptRepository.findPaginated(filters, pagination);
  }
}
