import { Session } from '../models/session.model';
import { SessionRevokedReason } from '../enums/auth.enums';

export interface ISessionRepository {
  findById(id: string): Promise<Session | null>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  revokeAllForUser(
    userId: string,
    reason: SessionRevokedReason,
    now: Date,
  ): Promise<void>;
}

export const SESSION_REPOSITORY = Symbol('ISessionRepository');
