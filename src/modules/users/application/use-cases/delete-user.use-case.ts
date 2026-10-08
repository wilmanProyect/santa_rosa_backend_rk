import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { GetUserUseCase } from './get-user.use-case';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  /** Borrado lógico: el registro se conserva para auditoría. */
  async execute(actorId: string, userId: string): Promise<void> {
    if (userId === actorId) {
      throw new BadRequestException('No puede eliminar su propio usuario');
    }
    await this.getUserUseCase.execute(userId);
    await this.userRepository.softDelete(userId, actorId);
  }
}
