import { AnimalWeighing } from '../../../domain/models/animal-weighing.model';
import { AnimalWeighingOrmEntity } from '../entities/animal-weighing.orm-entity';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';

export class AnimalWeighingMapper {
  /** Requiere la relación animal cargada (solo se usa su id). */
  static toDomain(e: AnimalWeighingOrmEntity): AnimalWeighing {
    return new AnimalWeighing({
      id: e.id,
      animalId: e.animal.id,
      weighedAt: e.weighedAt,
      weightKg: e.weightKg,
      type: e.type,
      bodyConditionScore: e.bodyConditionScore,
      isEstimated: e.isEstimated,
      nextWeighingAt: e.nextWeighingAt,
      notes: e.notes,
      audit: {
        createdAt: e.createdAt,
        createdBy: e.createdBy,
        updatedAt: e.updatedAt,
        updatedBy: e.updatedBy,
      },
    });
  }

  static toOrm(w: AnimalWeighing): AnimalWeighingOrmEntity {
    const audit = w.getAudit();
    const e = new AnimalWeighingOrmEntity();
    e.id = w.getId();
    e.animal = { id: w.getAnimalId() } as AnimalOrmEntity;
    e.weighedAt = w.getWeighedAt();
    e.weightKg = w.getWeightKg();
    e.type = w.getType();
    e.bodyConditionScore = w.getBodyConditionScore();
    e.isEstimated = w.getIsEstimated();
    e.nextWeighingAt = w.getNextWeighingAt();
    e.notes = w.getNotes();
    e.createdBy = audit.createdBy;
    e.updatedBy = audit.updatedBy;
    return e;
  }
}
