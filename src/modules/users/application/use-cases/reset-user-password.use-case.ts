import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '../../domain/ports/password-hasher.interface';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.interface';
import { Password } from '../../domain/value-objects/password.vo';
import { assertPasswordPolicy } from '../../domain/services/password-policy';
import { ResetPasswordDto } from '../dtos/reset-password.dto';
import { GetUserUseCase } from './get-user.use-case';

@Injectable()
export class ResetUserPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  /**
   * Asigna una contraseña temporal, desbloquea la cuenta y obliga a cambiarla.
   * Todas las sesiones abiertas del usuario quedan invalidadas.
   */
  async execute(
    actorId: string,
    userId: string,
    dto: ResetPasswordDto,
  ): Promise<void> {
    const user = await this.getUserUseCase.execute(userId);
    assertPasswordPolicy(dto.newPassword);

    const password = new Password(
      await this.passwordHasher.hash(dto.newPassword),
    );
    user.resetPassword(password, new Date());
    user.markUpdatedBy(actorId);
    await this.userRepository.save(user);
  }
}
