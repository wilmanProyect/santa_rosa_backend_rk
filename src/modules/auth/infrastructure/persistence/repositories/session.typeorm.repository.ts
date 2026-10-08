import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ISessionRepository } from '../../../domain/repositories/session.repository.interface';
import { Session } from '../../../domain/models/session.model';
import { SessionRevokedReason } from '../../../domain/enums/auth.enums';
import { SessionOrmEntity } from '../entities/session.orm-entity';
import { AuthMapper } from '../mappers/auth.mapper';

@Injectable()
export class SessionTypeormRepository implements ISessionRepository {
  constructor(
    @InjectRepository(SessionOrmEntity)
    private readonly repository: Repository<SessionOrmEntity>,
  ) {}

  async findById(id: string): Promise<Session | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? AuthMapper.sessionToDomain(entity) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const entity = await this.repository.findOne({ where: { tokenHash } });
    return entity ? AuthMapper.sessionToDomain(entity) : null;
  }

  async save(session: Session): Promise<void> {
    await this.repository.save(AuthMapper.sessionToOrm(session));
  }

  async revokeAllForUser(
    userId: string,
    reason: SessionRevokedReason,
    now: Date,
  ): Promise<void> {
    await this.repository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: now, revokedReason: reason },
    );
  }
}
