import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, Repository } from 'typeorm';
import {
  IAnimalWeighingRepository,
  PendingWeighing,
  WeightSummary,
} from '../../../domain/repositories/animal-weighing.repository.interface';
import {
  AnimalWeighing,
  WeighingType,
} from '../../../domain/models/animal-weighing.model';
import { AnimalWeighingOrmEntity } from '../entities/animal-weighing.orm-entity';
import { AnimalWeighingMapper } from '../mappers/animal-weighing.mapper';

@Injectable()
export class AnimalWeighingTypeormRepository implements IAnimalWeighingRepository {
  constructor(
    @InjectRepository(AnimalWeighingOrmEntity)
    private readonly repository: Repository<AnimalWeighingOrmEntity>,
  ) {}

  async findById(animalId: string, id: string): Promise<AnimalWeighing | null> {
    const entity = await this.repository.findOne({
      where: { id, animal: { id: animalId } },
      relations: { animal: true },
    });
    return entity ? AnimalWeighingMapper.toDomain(entity) : null;
  }

  async findByAnimal(animalId: string): Promise<AnimalWeighing[]> {
    const entities = await this.repository.find({
      where: { animal: { id: animalId } },
      relations: { animal: true },
      order: { weighedAt: 'ASC', createdAt: 'ASC' },
    });
    return entities.map((e) => AnimalWeighingMapper.toDomain(e));
  }

  async findPrevious(
    animalId: string,
    before: string,
    excludeId: string | null,
  ): Promise<AnimalWeighing | null> {
    const entity = await this.repository.findOne({
      where: {
        animal: { id: animalId },
        weighedAt: LessThan(before),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      relations: { animal: true },
      order: { weighedAt: 'DESC', createdAt: 'DESC' },
    });
    return entity ? AnimalWeighingMapper.toDomain(entity) : null;
  }

  async existsOfType(
    animalId: string,
    type: WeighingType,
    excludeId: string | null,
  ): Promise<boolean> {
    return this.repository.exists({
      where: {
        animal: { id: animalId },
        type,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
  }

  async findSummary(animalId: string): Promise<WeightSummary> {
    const rows: { kind: string; weighed_at: string; weight_kg: string }[] =
      await this.repository.query(
        `(SELECT 'birth' AS kind, to_char(weighed_at, 'YYYY-MM-DD') AS weighed_at, weight_kg
            FROM animal_weighings
           WHERE animal_id = $1 AND type = 'BIRTH' AND deleted_at IS NULL LIMIT 1)
         UNION ALL
         (SELECT 'weaning', to_char(weighed_at, 'YYYY-MM-DD'), weight_kg
            FROM animal_weighings
           WHERE animal_id = $1 AND type = 'WEANING' AND deleted_at IS NULL LIMIT 1)
         UNION ALL
         (SELECT 'last', to_char(weighed_at, 'YYYY-MM-DD'), weight_kg
            FROM animal_weighings
           WHERE animal_id = $1 AND deleted_at IS NULL
           ORDER BY weighed_at DESC, created_at DESC LIMIT 1)`,
        [animalId],
      );
    const pick = (kind: string) => {
      const row = rows.find((r) => r.kind === kind);
      return row
        ? { weighedAt: row.weighed_at, weightKg: Number(row.weight_kg) }
        : null;
    };
    return {
      birth: pick('birth'),
      weaning: pick('weaning'),
      last: pick('last'),
    };
  }

  async findPending(until: string): Promise<PendingWeighing[]> {
    const rows: {
      animal_id: string;
      ear_tag: string | null;
      name: string | null;
      next_weighing_at: string;
      weighed_at: string;
      weight_kg: string;
    }[] = await this.repository.query(
      `SELECT last.animal_id, a.ear_tag, a.name,
              to_char(last.next_weighing_at, 'YYYY-MM-DD') AS next_weighing_at,
              to_char(last.weighed_at, 'YYYY-MM-DD') AS weighed_at, last.weight_kg
         FROM (SELECT DISTINCT ON (animal_id) *
                 FROM animal_weighings
                WHERE deleted_at IS NULL
                ORDER BY animal_id, weighed_at DESC, created_at DESC) last
         JOIN animals a ON a.id = last.animal_id
        WHERE a.deleted_at IS NULL AND a.status = 'ALIVE' AND NOT a.is_external
          AND last.next_weighing_at IS NOT NULL AND last.next_weighing_at <= $1
        ORDER BY last.next_weighing_at, a.ear_tag`,
      [until],
    );
    return rows.map((r) => ({
      animalId: r.animal_id,
      earTag: r.ear_tag,
      name: r.name,
      nextWeighingAt: r.next_weighing_at,
      lastWeighedAt: r.weighed_at,
      lastWeightKg: Number(r.weight_kg),
    }));
  }

  async save(weighing: AnimalWeighing): Promise<void> {
    await this.repository.save(AnimalWeighingMapper.toOrm(weighing));
  }

  async saveMany(weighings: AnimalWeighing[]): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await manager.save(weighings.map((w) => AnimalWeighingMapper.toOrm(w)));
    });
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }
}
