import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USER_REPOSITORY } from '@modules/users/domain/repositories/user.repository.interface';
import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '@modules/users/domain/ports/password-hasher.interface';
import type { IPasswordHasher } from '@modules/users/domain/ports/password-hasher.interface';
import { User } from '@modules/users/domain/models/user.model';
import { LOGIN_ATTEMPT_REPOSITORY } from '../../domain/repositories/login-attempt.repository.interface';
import type { ILoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';
import { LoginAttempt } from '../../domain/models/login-attempt.model';
import { LoginFailureReason } from '../../domain/enums/auth.enums';
import { RequestContext } from '../../domain/authenticated-user';
import { AUTH_SETTINGS } from '../auth-settings';
import type { AuthSettings } from '../auth-settings';
import {
  AuthTokens,
  SessionIssuerService,
} from '../services/session-issuer.service';
import { LoginDto } from '../dtos/login.dto';

const INVALID_CREDENTIALS_MESSAGE = 'Usuario o contraseña incorrectos';

@Injectable()
export class LoginUseCase {
  /** Hash ficticio para que un usuario inexistente tarde lo mismo que uno real. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(LOGIN_ATTEMPT_REPOSITORY)
    private readonly loginAttemptRepository: ILoginAttemptRepository,
    @Inject(AUTH_SETTINGS)
    private readonly settings: AuthSettings,
    private readonly sessionIssuer: SessionIssuerService,
  ) {}

  async execute(
    dto: LoginDto,
    context: RequestContext,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    const now = new Date();
    const username = dto.username.trim().toLowerCase();
    const user = await this.userRepository.findByUsername(username);

    if (!user) {
      await this.passwordHasher.compare(
        dto.password,
        await this.getDummyHash(),
      );
      await this.recordFailure(
        null,
        username,
        LoginFailureReason.INVALID_CREDENTIALS,
        context,
        now,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (user.isLocked(now)) {
      await this.recordFailure(
        user.getId(),
        username,
        LoginFailureReason.ACCOUNT_LOCKED,
        context,
        now,
      );
      throw new UnauthorizedException(this.lockedMessage(user, now));
    }

    const validPassword = await this.passwordHasher.compare(
      dto.password,
      user.getPassword().getHash(),
    );
    if (!validPassword) {
      user.registerFailedLogin(
        {
          maxFailedAttempts: this.settings.maxFailedAttempts,
          lockMinutes: this.settings.lockMinutes,
        },
        now,
      );
      await this.userRepository.saveLoginState(user);
      await this.recordFailure(
        user.getId(),
        username,
        LoginFailureReason.INVALID_CREDENTIALS,
        context,
        now,
      );
      throw new UnauthorizedException(
        user.isLocked(now)
          ? this.lockedMessage(user, now)
          : INVALID_CREDENTIALS_MESSAGE,
      );
    }

    // Se verifica después de la contraseña para no revelar el estado a quien no la conoce.
    if (!user.isActive()) {
      await this.recordFailure(
        user.getId(),
        username,
        LoginFailureReason.USER_INACTIVE,
        context,
        now,
      );
      throw new UnauthorizedException(
        'El usuario está inactivo. Contacte al administrador.',
      );
    }

    user.registerSuccessfulLogin(now);
    await this.userRepository.saveLoginState(user);
    await this.loginAttemptRepository.save(
      LoginAttempt.succeeded(user.getId(), username, context, now),
    );

    const tokens = await this.sessionIssuer.issue(user, context, now);
    return { user, tokens };
  }

  private async recordFailure(
    userId: string | null,
    username: string,
    reason: LoginFailureReason,
    context: RequestContext,
    now: Date,
  ): Promise<void> {
    await this.loginAttemptRepository.save(
      LoginAttempt.failed(userId, username, reason, context, now),
    );
  }

  private lockedMessage(user: User, now: Date): string {
    const lockedUntil = user.getLockedUntil()!;
    const minutes = Math.max(
      1,
      Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000),
    );
    return `Cuenta bloqueada por demasiados intentos fallidos. Intente nuevamente en ${minutes} minuto(s).`;
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwordHasher.hash('dummy-password-for-timing');
    return this.dummyHash;
  }
}
