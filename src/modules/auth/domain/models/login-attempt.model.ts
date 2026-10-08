import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { LoginFailureReason } from '../enums/auth.enums';
import { RequestContext } from '../authenticated-user';

export interface LoginAttemptProps {
  id: string;
  /** Nulo si el usuario ingresado no existe. */
  userId: string | null;
  username: string;
  success: boolean;
  failureReason: LoginFailureReason | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export class LoginAttempt {
  constructor(private readonly props: LoginAttemptProps) {}

  static succeeded(
    userId: string,
    username: string,
    context: RequestContext,
    now: Date,
  ) {
    return LoginAttempt.build(userId, username, true, null, context, now);
  }

  static failed(
    userId: string | null,
    username: string,
    reason: LoginFailureReason,
    context: RequestContext,
    now: Date,
  ) {
    return LoginAttempt.build(userId, username, false, reason, context, now);
  }

  private static build(
    userId: string | null,
    username: string,
    success: boolean,
    failureReason: LoginFailureReason | null,
    context: RequestContext,
    now: Date,
  ): LoginAttempt {
    return new LoginAttempt({
      id: new UUID().getValue(),
      userId,
      username: username.slice(0, 100),
      success,
      failureReason,
      ip: context.ip,
      userAgent: context.userAgent,
      createdAt: now,
    });
  }

  public getId(): string {
    return this.props.id;
  }

  public getUserId(): string | null {
    return this.props.userId;
  }

  public getUsername(): string {
    return this.props.username;
  }

  public getSuccess(): boolean {
    return this.props.success;
  }

  public getFailureReason(): LoginFailureReason | null {
    return this.props.failureReason;
  }

  public getIp(): string | null {
    return this.props.ip;
  }

  public getUserAgent(): string | null {
    return this.props.userAgent;
  }

  public getCreatedAt(): Date {
    return this.props.createdAt;
  }
}
