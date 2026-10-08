import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { USER_REPOSITORY } from '@modules/users/domain/repositories/user.repository.interface';
import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '@modules/users/domain/ports/password-hasher.interface';
import type { IPasswordHasher } from '@modules/users/domain/ports/password-hasher.interface';
import { Password } from '@modules/users/domain/value-objects/password.vo';
import { assertPasswordPolicy } from '@modules/users/domain/services/password-policy';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { SessionRevokedReason } from '../../domain/enums/auth.enums';
import { RequestContext } from '../../domain/authenticated-user';
import {
  AuthTokens,
  SessionIssuerService,
} from '../services/session-issuer.service';
import { ChangePasswordDto } from '../dtos/change-password.dto';

/**
 * Cambio de contraseña del propio usuario. Cierra todas sus sesiones
 * (incluidas las de otros dispositivos) y devuelve tokens nuevos.
 */
@Injectable()
export class ChangeOwnPasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    private readonly sessionIssuer: SessionIssuerService,
  ) {}

  async execute(
    userId: string,
    dto: ChangePasswordDto,
    context: RequestContext,
  ): Promise<AuthTokens> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }

    const currentHash = user.getPassword().getHash();
    if (
      !(await this.passwordHasher.compare(dto.currentPassword, currentHash))
    ) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    assertPasswordPolicy(dto.newPassword);
    if (await this.passwordHasher.compare(dto.newPassword, currentHash)) {
      throw new BadRequestException(
        'La nueva contraseña debe ser distinta de la actual',
      );
    }

    const now = new Date();
    user.changePassword(
      new Password(await this.passwordHasher.hash(dto.newPassword)),
      now,
    );
    await this.userRepository.save(user);
    await this.sessionRepository.revokeAllForUser(
      user.getId(),
      SessionRevokedReason.PASSWORD_CHANGED,
      now,
    );

    return this.sessionIssuer.issue(user, context, now);
  }
}
