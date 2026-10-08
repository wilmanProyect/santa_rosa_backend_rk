import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { User } from '@modules/users/domain/models/user.model';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { TOKEN_SERVICE } from '../../domain/ports/token-service.interface';
import type { ITokenService } from '../../domain/ports/token-service.interface';
import { Session } from '../../domain/models/session.model';
import { RequestContext } from '../../domain/authenticated-user';
import { AUTH_SETTINGS } from '../auth-settings';
import type { AuthSettings } from '../auth-settings';

export interface AuthTokens {
  tokenType: 'Bearer';
  accessToken: string;
  /** Segundos de validez del access token. */
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Crea una sesión nueva (refresh token) y su access token. */
@Injectable()
export class SessionIssuerService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    @Inject(AUTH_SETTINGS)
    private readonly settings: AuthSettings,
  ) {}

  async issue(
    user: User,
    context: RequestContext,
    now: Date,
  ): Promise<AuthTokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    const session = Session.create({
      userId: user.getId(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(
        now.getTime() + this.settings.refreshTokenTtlDays * 86_400_000,
      ),
      now,
      context,
    });
    await this.sessionRepository.save(session);

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.getId(),
      sid: session.getId(),
    });

    return {
      tokenType: 'Bearer',
      accessToken,
      expiresIn: this.settings.accessTokenTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: session.getExpiresAt(),
    };
  }
}
