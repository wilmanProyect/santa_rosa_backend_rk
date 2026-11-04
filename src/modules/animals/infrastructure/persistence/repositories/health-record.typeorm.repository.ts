import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  ActiveWithdrawal,
  HealthRecordFilters,
  IHealthRecordRepository,
  PendingDose,
} from '../../../domain/repositories/health-record.repository.interface';
import { HealthRecord } from '../../../domain/models/health-record.model';
import { HealthRecordOrmEntity } from '../entities/health-record.orm-entity';
import { HealthRecordMapper } from '../mappers/health-record.mapper';

@Injectable()
export class HealthRecordTypeormRepository implements IHealthRecordRepository {
  constructor(
    @InjectRepository(HealthRecordOrmEntity)
    private readonly repository: Repository<HealthRecordOrmEntity>,
  ) {}

  async findById(id: string): Promise<HealthRecord | null> {
    const entity = await this.baseQuery()
      .andWhere('record.id = :id', { id })
      .getOne();
    return entity ? HealthRecordMapper.toDomain(entity) : null;
  }

  async findPaginated(
    filters: HealthRecordFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<HealthRecord>> {
    const query = this.baseQuery();
    if (filters.animalId) {
      query.andWhere('animal.id = :animalId', { animalId: filters.animalId });
    }
    if (filters.generalOnly) query.andWhere('record.animal IS NULL');
    if (filters.types?.length) {
      query.andWhere('record.type IN (:...types)', { types: filters.types });
    }
    if (filters.productId) {
      query.andWhere('product.id = :productId', {
        productId: filters.productId,
      });
    }
    if (filters.targetCondition?.trim()) {
      query.andWhere('record.targetCondition ILIKE :condition', {
        condition: `%${escapeLike(filters.targetCondition.trim())}%`,
      });
    }
    if (filters.from) {
      query.andWhere('record.appliedAt >= :from', { from: filters.from });
    }
    if (filters.to)
      query.andWhere('record.appliedAt <= :to', { to: filters.to });

    const [entities, total] = await query
      .orderBy('record.appliedAt', 'DESC')
      .addOrderBy('record.createdAt', 'DESC')
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .getManyAndCount();
    return {
      items: entities.map((e) => HealthRecordMapper.toDomain(e)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findActiveWithdrawal(
    animalId: string,
    onDate: string,
  ): Promise<{ meat: ActiveWithdrawal | null; milk: ActiveWithdrawal | null }> {
    type Row = { ends_on: string; applied_at: string; product_name: string };
    const query = (
      days: 'meat_withdrawal_days' | 'milk_withdrawal_days',
    ): Promise<Row[]> =>
      this.repository.query(
        `SELECT to_char(r.applied_at + r.${days}, 'YYYY-MM-DD') AS ends_on,
                to_char(r.applied_at, 'YYYY-MM-DD') AS applied_at, p.name AS product_name
           FROM health_records r
           JOIN veterinary_products p ON p.id = r.product_id
          WHERE r.animal_id = $1 AND r.deleted_at IS NULL
            AND r.${days} > 0 AND r.applied_at <= $2
            AND r.applied_at + r.${days} > $2
          ORDER BY r.applied_at + r.${days} DESC
          LIMIT 1`,
        [animalId, onDate],
      );
    const [meat, milk] = await Promise.all([
      query('meat_withdrawal_days'),
      query('milk_withdrawal_days'),
    ]);
    const toResult = (rows: Row[]): ActiveWithdrawal | null =>
      rows[0]
        ? {
            endsOn: rows[0].ends_on,
            appliedAt: rows[0].applied_at,
            productName: rows[0].product_name,
          }
        : null;
    return { meat: toResult(meat), milk: toResult(milk) };
  }

  async findPendingDoses(until: string): Promise<PendingDose[]> {
    const rows: {
      id: string;
      animal_id: string | null;
      ear_tag: string | null;
      name: string | null;
      type: PendingDose['type'];
      product_name: string | null;
      target_condition: string | null;
      location: string | null;
      applied_at: string;
      next_dose_at: string;
    }[] = await this.repository.query(
      `SELECT r.id, r.animal_id, a.ear_tag, a.name, r.type, p.name AS product_name,
              r.target_condition, r.location,
              to_char(r.applied_at, 'YYYY-MM-DD') AS applied_at,
              to_char(r.next_dose_at, 'YYYY-MM-DD') AS next_dose_at
         FROM health_records r
         LEFT JOIN animals a ON a.id = r.animal_id
         LEFT JOIN veterinary_products p ON p.id = r.product_id
        WHERE r.deleted_at IS NULL AND r.next_dose_at IS NOT NULL AND r.next_dose_at <= $1
          AND (r.animal_id IS NULL OR (a.deleted_at IS NULL AND a.status = 'ALIVE'))
          AND NOT EXISTS (
            SELECT 1 FROM health_records later
             WHERE later.deleted_at IS NULL AND later.type = r.type
               AND later.applied_at > r.applied_at
               AND (later.animal_id = r.animal_id
                    OR (r.animal_id IS NULL AND later.animal_id IS NULL
                        AND later.location IS NOT DISTINCT FROM r.location)))
        ORDER BY r.next_dose_at, a.ear_tag`,
      [until],
    );
    return rows.map((r) => ({
      recordId: r.id,
      animalId: r.animal_id,
      earTag: r.ear_tag,
      name: r.name,
      type: r.type,
      productName: r.product_name,
      targetCondition: r.target_condition,
      location: r.location,
      lastAppliedAt: r.applied_at,
      nextDoseAt: r.next_dose_at,
    }));
  }

  async save(record: HealthRecord): Promise<void> {
    await this.repository.save(HealthRecordMapper.toOrm(record));
  }

  async saveMany(records: HealthRecord[]): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await manager.save(records.map((r) => HealthRecordMapper.toOrm(r)));
    });
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  private baseQuery() {
    return (
      this.repository
        .createQueryBuilder('record')
        .leftJoinAndSelect('record.animal', 'animal')
        .leftJoinAndSelect('record.product', 'product')
        // Los eventos de un animal eliminado no se muestran (el join no lo carga).
        .where("(record.type = 'CORRAL_CLEANING' OR animal.id IS NOT NULL)")
    );
  }
}
