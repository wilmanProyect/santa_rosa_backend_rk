import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { SessionRevokedReason } from '../enums/auth.enums';
import { RequestContext } from '../authenticated-user';

export interface SessionProps {
  id: string;
  userId: string;
  /** SHA-256 del refresh token; el token en claro nunca se guarda. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevokedReason | null;
  ip: string | null;
  userAgent: string | null;
}

export class Session {
  constructor(private readonly props: SessionProps) {}

  static create(params: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
    context: RequestContext;
  }): Session {
    return new Session({
      id: new UUID().getValue(),
      userId: params.userId,
      tokenHash: params.tokenHash,
      createdAt: params.now,
      expiresAt: params.expiresAt,
      revokedAt: null,
      revokedReason: null,
      ip: params.context.ip,
      userAgent: params.context.userAgent,
    });
  }

  public getId(): string {
    return this.props.id;
  }

  public getUserId(): string {
    return this.props.userId;
  }

  public getTokenHash(): string {
    return this.props.tokenHash;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }

  public getExpiresAt(): Date {
    return this.props.expiresAt;
  }

  public getRevokedAt(): Date | null {
    return this.props.revokedAt;
  }

  public getRevokedReason(): SessionRevokedReason | null {
    return this.props.revokedReason;
  }

  public getIp(): string | null {
    return this.props.ip;
  }

  public getUserAgent(): string | null {
    return this.props.userAgent;
  }

  public isRevoked(): boolean {
    return this.props.revokedAt !== null;
  }

  public isExpired(now: Date): boolean {
    return this.props.expiresAt.getTime() <= now.getTime();
  }

  public isActive(now: Date): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  public revoke(reason: SessionRevokedReason, now: Date): void {
    if (this.isRevoked()) return;
    this.props.revokedAt = now;
    this.props.revokedReason = reason;
  }
}
