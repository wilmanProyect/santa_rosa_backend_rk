import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { USER_REPOSITORY } from '@modules/users/domain/repositories/user.repository.interface';
import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { SessionRevokedReason } from '../../domain/enums/auth.enums';
import { RequestContext } from '../../domain/authenticated-user';
import {
  AuthTokens,
  SessionIssuerService,
  hashRefreshToken,
} from '../services/session-issuer.service';
import { RefreshTokenDto } from '../dtos/refresh-token.dto';

const INVALID_SESSION_MESSAGE =
  'Sesión inválida o expirada. Inicie sesión nuevamente.';

/**
 * Rota el refresh token: invalida el actual y entrega uno nuevo.
 * Si se reutiliza un token ya rotado, se cierran todas las sesiones del usuario.
 */
@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly sessionIssuer: SessionIssuerService,
  ) {}

  async execute(
    dto: RefreshTokenDto,
    context: RequestContext,
  ): Promise<AuthTokens> {
    const now = new Date();
    const session = await this.sessionRepository.findByTokenHash(
      hashRefreshToken(dto.refreshToken),
    );
    if (!session) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (session.isRevoked()) {
      if (session.getRevokedReason() === SessionRevokedReason.ROTATED) {
        await this.sessionRepository.revokeAllForUser(
          session.getUserId(),
          SessionRevokedReason.REUSE_DETECTED,
          now,
        );
      }
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    if (session.isExpired(now)) {
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    const user = await this.userRepository.findById(session.getUserId());
    if (
      !user ||
      !user.isActive() ||
      !user.isSessionStillValid(session.getCreatedAt())
    ) {
      session.revoke(SessionRevokedReason.INVALIDATED, now);
      await this.sessionRepository.save(session);
      throw new UnauthorizedException(INVALID_SESSION_MESSAGE);
    }

    session.revoke(SessionRevokedReason.ROTATED, now);
    await this.sessionRepository.save(session);
    return this.sessionIssuer.issue(user, context, now);
  }
}
