import { AnimalWeighing } from '../../domain/models/animal-weighing.model';
import type { WeighingWithMetrics } from '../../application/use-cases/weighings/weighing.use-cases';

export class WeighingPresenter {
  /** Respuesta al crear o editar: incluye las advertencias. */
  static toResponse(weighing: AnimalWeighing, warnings: string[] = []) {
    return { ...this.base(weighing), warnings };
  }

  /** Historial: incluye edad, diferencia y ganancia diaria. */
  static withMetrics(item: WeighingWithMetrics) {
    return {
      ...this.base(item.weighing),
      ageDays: item.ageDays,
      changeKg: item.changeKg,
      dailyGainG: item.dailyGainG,
    };
  }

  private static base(weighing: AnimalWeighing) {
    const audit = weighing.getAudit();
    return {
      id: weighing.getId(),
      animalId: weighing.getAnimalId(),
      weighedAt: weighing.getWeighedAt(),
      weightKg: weighing.getWeightKg(),
      type: weighing.getType(),
      bodyConditionScore: weighing.getBodyConditionScore(),
      isEstimated: weighing.getIsEstimated(),
      nextWeighingAt: weighing.getNextWeighingAt(),
      notes: weighing.getNotes(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
