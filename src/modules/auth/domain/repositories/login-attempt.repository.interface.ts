import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { LoginAttempt } from '../models/login-attempt.model';

export interface LoginAttemptFilters {
  userId?: string;
  success?: boolean;
}

export interface ILoginAttemptRepository {
  save(attempt: LoginAttempt): Promise<void>;
  findPaginated(
    filters: LoginAttemptFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<LoginAttempt>>;
}

export const LOGIN_ATTEMPT_REPOSITORY = Symbol('ILoginAttemptRepository');
