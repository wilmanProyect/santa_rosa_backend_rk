import { Session } from '../../../domain/models/session.model';
import { LoginAttempt } from '../../../domain/models/login-attempt.model';
import { SessionOrmEntity } from '../entities/session.orm-entity';
import { LoginAttemptOrmEntity } from '../entities/login-attempt.orm-entity';

export class AuthMapper {
  static sessionToDomain(ormEntity: SessionOrmEntity): Session {
    return new Session({
      id: ormEntity.id,
      userId: ormEntity.userId,
      tokenHash: ormEntity.tokenHash,
      createdAt: ormEntity.createdAt,
      expiresAt: ormEntity.expiresAt,
      revokedAt: ormEntity.revokedAt,
      revokedReason: ormEntity.revokedReason,
      ip: ormEntity.ip,
      userAgent: ormEntity.userAgent,
    });
  }

  static sessionToOrm(domainModel: Session): SessionOrmEntity {
    const ormEntity = new SessionOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.userId = domainModel.getUserId();
    ormEntity.tokenHash = domainModel.getTokenHash();
    ormEntity.createdAt = domainModel.getCreatedAt();
    ormEntity.expiresAt = domainModel.getExpiresAt();
    ormEntity.revokedAt = domainModel.getRevokedAt();
    ormEntity.revokedReason = domainModel.getRevokedReason();
    ormEntity.ip = domainModel.getIp();
    ormEntity.userAgent = domainModel.getUserAgent();
    return ormEntity;
  }

  static loginAttemptToDomain(ormEntity: LoginAttemptOrmEntity): LoginAttempt {
    return new LoginAttempt({
      id: ormEntity.id,
      userId: ormEntity.userId,
      username: ormEntity.username,
      success: ormEntity.success,
      failureReason: ormEntity.failureReason,
      ip: ormEntity.ip,
      userAgent: ormEntity.userAgent,
      createdAt: ormEntity.createdAt,
    });
  }

  static loginAttemptToOrm(domainModel: LoginAttempt): LoginAttemptOrmEntity {
    const ormEntity = new LoginAttemptOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.userId = domainModel.getUserId();
    ormEntity.username = domainModel.getUsername();
    ormEntity.success = domainModel.getSuccess();
    ormEntity.failureReason = domainModel.getFailureReason();
    ormEntity.ip = domainModel.getIp();
    ormEntity.userAgent = domainModel.getUserAgent();
    ormEntity.createdAt = domainModel.getCreatedAt();
    return ormEntity;
  }
}
