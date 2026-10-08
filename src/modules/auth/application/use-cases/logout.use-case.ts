import { Inject, Injectable } from '@nestjs/common';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { SessionRevokedReason } from '../../domain/enums/auth.enums';

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
  ) {}

  /** Cierra la sesión actual, o todas las del usuario si allSessions es true. */
  async execute(
    userId: string,
    sessionId: string,
    allSessions = false,
  ): Promise<void> {
    const now = new Date();
    if (allSessions) {
      await this.sessionRepository.revokeAllForUser(
        userId,
        SessionRevokedReason.LOGOUT,
        now,
      );
      return;
    }

    const session = await this.sessionRepository.findById(sessionId);
    if (session && session.getUserId() === userId) {
      session.revoke(SessionRevokedReason.LOGOUT, now);
      await this.sessionRepository.save(session);
    }
  }
}
