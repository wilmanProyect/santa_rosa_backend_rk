import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import {
  IBreedingServiceRepository,
  ServiceFilters,
} from '../../../domain/repositories/reproduction.repository.interface';
import { BreedingService } from '../../../domain/models/breeding-service.model';
import { OPEN_SERVICE_STATUSES } from '../../../domain/enums/reproduction.enums';
import { BreedingServiceOrmEntity } from '../entities/breeding-service.orm-entity';
import { PregnancyCheckOrmEntity } from '../entities/pregnancy-check.orm-entity';
import { BreedingServiceMapper } from '../mappers/reproduction.mappers';
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';

@Injectable()
export class BreedingServiceTypeormRepository implements IBreedingServiceRepository {
  constructor(
    @InjectRepository(BreedingServiceOrmEntity)
    private readonly repository: Repository<BreedingServiceOrmEntity>,
    @InjectRepository(PregnancyCheckOrmEntity)
    private readonly checks: Repository<PregnancyCheckOrmEntity>,
  ) {}

  async findById(id: string): Promise<BreedingService | null> {
    const entity = await this.baseQuery().where('s.id = :id', { id }).getOne();
    if (!entity) return null;
    await this.attachChecks([entity]);
    return BreedingServiceMapper.toDomain(entity);
  }

  async findPaginated(
    filters: ServiceFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<BreedingService>> {
    const query = this.baseQuery();
    if (filters.status) {
      query.andWhere('s.status = :status', { status: filters.status });
    }
    if (filters.type) query.andWhere('s.type = :type', { type: filters.type });
    if (filters.species) {
      query.andWhere('s.species = :species', { species: filters.species });
    }
    if (filters.animalId) {
      query.andWhere('(dam.id = :animalId OR sire.id = :animalId)', {
        animalId: filters.animalId,
      });
    }
    if (filters.damId)
      query.andWhere('dam.id = :damId', { damId: filters.damId });
    if (filters.sireId) {
      query.andWhere('sire.id = :sireId', { sireId: filters.sireId });
    }
    if (filters.from) {
      query.andWhere('s.serviceDate >= :from', { from: filters.from });
    }
    if (filters.to) query.andWhere('s.serviceDate <= :to', { to: filters.to });
    if (filters.kinshipOverride !== undefined) {
      query.andWhere(
        filters.kinshipOverride
          ? 's.kinshipOverrideBy IS NOT NULL'
          : 's.kinshipOverrideBy IS NULL',
      );
    }

    // dam y sire son muchos-a-uno: no multiplican filas. Los diagnósticos se
    // cargan aparte para que OFFSET/LIMIT paginen montas y no diagnósticos.
    const [entities, total] = await query
      .orderBy('s.serviceDate', 'DESC')
      .addOrderBy('s.createdAt', 'DESC')
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .getManyAndCount();
    await this.attachChecks(entities);
    return {
      items: entities.map((e) => BreedingServiceMapper.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findOpenForDam(
    damId: string,
    excludeId: string | null,
  ): Promise<BreedingService | null> {
    const query = this.baseQuery()
      .where('dam.id = :damId', { damId })
      .andWhere('s.status IN (:...open)', { open: OPEN_SERVICE_STATUSES });
    if (excludeId) query.andWhere('s.id <> :excludeId', { excludeId });
    const entity = await query.orderBy('s.serviceDate', 'DESC').getOne();
    if (!entity) return null;
    await this.attachChecks([entity]);
    return BreedingServiceMapper.toDomain(entity);
  }

  async save(service: BreedingService, actorId: string): Promise<void> {
    const entity = BreedingServiceMapper.toOrm(service);
    const keep = new Set(entity.checks.map((c) => c.id));
    await this.repository.manager.transaction(async (manager) => {
      const existing = await manager.find(PregnancyCheckOrmEntity, {
        select: { id: true },
        where: { service: { id: entity.id }, deletedAt: IsNull() },
      });
      const removed = existing.map((c) => c.id).filter((id) => !keep.has(id));
      if (removed.length > 0) {
        await manager.update(
          PregnancyCheckOrmEntity,
          { id: In(removed) },
          { updatedBy: actorId },
        );
        await manager.softDelete(PregnancyCheckOrmEntity, { id: In(removed) });
      }
      await manager.save(entity);
    });
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await manager.update(
        BreedingServiceOrmEntity,
        { id },
        { updatedBy: actorId },
      );
      await manager.softDelete(BreedingServiceOrmEntity, { id });
      await manager.query(
        `UPDATE pregnancy_checks SET deleted_at = now(), updated_by = $2
          WHERE service_id = $1 AND deleted_at IS NULL`,
        [id, actorId],
      );
    });
  }

  private baseQuery() {
    return this.repository
      .createQueryBuilder('s')
      .innerJoinAndSelect('s.dam', 'dam')
      .innerJoinAndSelect('s.sire', 'sire')
      .leftJoinAndMapOne(
        's.creator',
        UserOrmEntity,
        'creator',
        'creator.id = s.createdBy',
      );
  }

  private async attachChecks(entities: BreedingServiceOrmEntity[]) {
    if (entities.length === 0) return;
    const checks = await this.checks.find({
      where: { service: { id: In(entities.map((e) => e.id)) } },
      relations: { service: true },
      order: { checkedAt: 'ASC', createdAt: 'ASC' },
    });
    for (const entity of entities) {
      entity.checks = checks.filter((c) => c.service.id === entity.id);
    }
  }
}
