import { Inject, Injectable } from '@nestjs/common';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type {
  IUserRepository,
  UserFilters,
} from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/models/user.model';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    filters: UserFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<User>> {
    return this.userRepository.findPaginated(filters, pagination);
  }
}
