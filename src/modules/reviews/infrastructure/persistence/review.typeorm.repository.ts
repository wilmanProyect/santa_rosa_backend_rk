import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { Paginated, PaginationParams } from '@shared/domain/paginated';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  DataReview,
  ReviewEntityType,
  ReviewStatus,
  type ReviewTarget,
} from '../../domain/review.model';
import type {
  IReviewRepository,
  ReviewFilters,
  ReviewTargetSummary,
} from '../../domain/review.repository.interface';
import { DataReviewOrmEntity } from './entities/data-review.orm-entity';
import { DataReviewTargetOrmEntity } from './entities/data-review-target.orm-entity';

/** Etiqueta legible de un animal: arete (o registro) y nombre. */
const ANIMAL_LABEL = (a: string) =>
  `concat_ws(' ', COALESCE(${a}."ear_tag", ${a}."external_registry", ${a}."absid_registry"), ${a}."name",
     CASE WHEN ${a}."is_external" THEN '(externo)' END)`;

@Injectable()
export class ReviewTypeormRepository implements IReviewRepository {
  constructor(
    @InjectRepository(DataReviewOrmEntity)
    private readonly reviews: Repository<DataReviewOrmEntity>,
    @InjectRepository(DataReviewTargetOrmEntity)
    private readonly targets: Repository<DataReviewTargetOrmEntity>,
  ) {}

  async findById(id: string): Promise<DataReview | null> {
    const entity = await this.reviews.findOne({
      where: { id },
      relations: { targets: true },
    });
    return entity ? toDomain(entity) : null;
  }

  async findPaginated(
    filters: ReviewFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<DataReview>> {
    const qb = this.reviews.createQueryBuilder('r');
    if (filters.status) qb.andWhere('r.status = :status', filters);
    if (filters.category) qb.andWhere('r.category = :category', filters);
    if (filters.entityType || filters.entityId) {
      const conditions = ['t.review_id = r.id'];
      if (filters.entityType) conditions.push('t.entity_type = :entityType');
      if (filters.entityId) conditions.push('t.entity_id = :entityId');
      qb.andWhere(
        `EXISTS (SELECT 1 FROM data_review_targets t WHERE ${conditions.join(' AND ')})`,
        filters,
      );
    }
    if (filters.search) {
      qb.andWhere(`r.message ILIKE :search ESCAPE '\\'`, {
        search: `%${escapeLike(filters.search)}%`,
      });
    }
    // Pendientes primero; dentro de cada grupo, los más recientes.
    qb.orderBy(`CASE WHEN r.status = 'OPEN' THEN 0 ELSE 1 END`)
      .addOrderBy('r.createdAt', 'DESC')
      .addOrderBy('r.id')
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit);
    const [entities, total] = await qb.getManyAndCount();

    const targets = entities.length
      ? await this.targets.find({
          where: { review: { id: In(entities.map((e) => e.id)) } },
          relations: { review: true },
        })
      : [];
    for (const e of entities) {
      e.targets = targets.filter((t) => t.review.id === e.id);
    }
    return {
      items: entities.map(toDomain),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async save(review: DataReview): Promise<void> {
    const p = review.toProps();
    const exists = await this.reviews.exists({ where: { id: p.id } });
    const row = {
      id: p.id,
      category: p.category,
      message: p.message,
      source: p.source,
      status: p.status,
      resolution: p.resolution,
      resolvedAt: p.resolvedAt,
      resolvedBy: p.resolvedBy,
      createdBy: p.createdBy,
      updatedBy: p.updatedBy,
    };
    if (exists) {
      // Los registros asociados no cambian después de crear el aviso.
      await this.reviews.save(row);
      return;
    }
    await this.reviews.manager.transaction(async (manager) => {
      await manager.insert(DataReviewOrmEntity, row);
      await manager.insert(
        DataReviewTargetOrmEntity,
        p.targets.map((t, i) => ({
          id: randomUUID(),
          review: { id: p.id },
          entityType: t.entityType,
          entityId: t.entityId,
          role: t.role,
          position: i + 1,
        })),
      );
    });
  }

  async findMissingTargets(targets: ReviewTarget[]): Promise<ReviewTarget[]> {
    const found = new Set(
      (await this.describeTargets(targets))
        .filter((s) => s.exists)
        .map((s) => `${s.entityType}:${s.entityId}`),
    );
    return targets.filter((t) => !found.has(`${t.entityType}:${t.entityId}`));
  }

  async describeTargets(
    targets: ReviewTarget[],
  ): Promise<ReviewTargetSummary[]> {
    const ids = (type: ReviewEntityType) => [
      ...new Set(
        targets.filter((t) => t.entityType === type).map((t) => t.entityId),
      ),
    ];
    const [animals, births, services] = await Promise.all([
      this.query(
        ids(ReviewEntityType.ANIMAL),
        `SELECT a.id, ${ANIMAL_LABEL('a')} AS label, a.deleted_at IS NULL AS exists
           FROM animals a WHERE a.id = ANY($1)`,
      ),
      this.query(
        ids(ReviewEntityType.BIRTH),
        `SELECT b.id, b.deleted_at IS NULL AS exists,
                concat('Parto de ', ${ANIMAL_LABEL('d')}, ' del ', to_char(b.birth_date, 'DD/MM/YYYY')) AS label
           FROM births b JOIN animals d ON d.id = b.dam_id WHERE b.id = ANY($1)`,
      ),
      this.query(
        ids(ReviewEntityType.BREEDING_SERVICE),
        `SELECT s.id, s.deleted_at IS NULL AS exists,
                concat('Monta de ', ${ANIMAL_LABEL('d')}, ' × ', ${ANIMAL_LABEL('m')},
                       ' del ', to_char(s.service_date, 'DD/MM/YYYY')) AS label
           FROM breeding_services s
           JOIN animals d ON d.id = s.dam_id
           JOIN animals m ON m.id = s.sire_id
          WHERE s.id = ANY($1)`,
      ),
    ]);
    const byKey = new Map<string, { label: string; exists: boolean }>();
    const add = (type: ReviewEntityType, rows: Row[]) =>
      rows.forEach((r) => byKey.set(`${type}:${r.id}`, r));
    add(ReviewEntityType.ANIMAL, animals);
    add(ReviewEntityType.BIRTH, births);
    add(ReviewEntityType.BREEDING_SERVICE, services);
    return targets.map((t) => {
      const row = byKey.get(`${t.entityType}:${t.entityId}`);
      return {
        entityType: t.entityType,
        entityId: t.entityId,
        label: row?.label ?? 'Registro inexistente',
        exists: row?.exists ?? false,
      };
    });
  }

  async openTargetCounts(
    entityType: ReviewEntityType,
  ): Promise<{ entityId: string; count: number }[]> {
    const rows: { entity_id: string; count: string }[] =
      await this.reviews.query(
        `SELECT t.entity_id, COUNT(*) AS count
           FROM data_review_targets t
           JOIN data_reviews r ON r.id = t.review_id
          WHERE t.entity_type = $1 AND r.status = $2 AND r.deleted_at IS NULL
          GROUP BY t.entity_id`,
        [entityType, ReviewStatus.OPEN],
      );
    return rows.map((r) => ({ entityId: r.entity_id, count: Number(r.count) }));
  }

  async countOpen(): Promise<number> {
    return this.reviews.count({ where: { status: ReviewStatus.OPEN } });
  }

  private async query(ids: string[], sql: string): Promise<Row[]> {
    if (ids.length === 0) return [];
    return this.reviews.query(sql, [ids]);
  }
}

interface Row {
  id: string;
  label: string;
  exists: boolean;
}

function toDomain(e: DataReviewOrmEntity): DataReview {
  return DataReview.restore({
    id: e.id,
    category: e.category,
    message: e.message,
    source: e.source,
    status: e.status,
    resolution: e.resolution,
    resolvedAt: e.resolvedAt,
    resolvedBy: e.resolvedBy,
    targets: [...(e.targets ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        entityType: t.entityType,
        entityId: t.entityId,
        role: t.role,
      })),
    createdAt: e.createdAt,
    createdBy: e.createdBy,
    updatedAt: e.updatedAt,
    updatedBy: e.updatedBy,
  });
}
