import { AnimalWeighing, WeighingType } from '../models/animal-weighing.model';

export interface WeightSummary {
  birth: { weighedAt: string; weightKg: number } | null;
  weaning: { weighedAt: string; weightKg: number } | null;
  last: { weighedAt: string; weightKg: number } | null;
}

export interface PendingWeighing {
  animalId: string;
  earTag: string | null;
  name: string | null;
  nextWeighingAt: string;
  lastWeighedAt: string;
  lastWeightKg: number;
}

export interface IAnimalWeighingRepository {
  findById(animalId: string, id: string): Promise<AnimalWeighing | null>;
  /** Historial del animal, del más antiguo al más reciente. */
  findByAnimal(animalId: string): Promise<AnimalWeighing[]>;
  /** El pesaje inmediatamente anterior a esa fecha (excluyendo uno). */
  findPrevious(
    animalId: string,
    before: string,
    excludeId: string | null,
  ): Promise<AnimalWeighing | null>;
  existsOfType(
    animalId: string,
    type: WeighingType,
    excludeId: string | null,
  ): Promise<boolean>;
  findSummary(animalId: string): Promise<WeightSummary>;
  /**
   * Animales vivos cuyo último pesaje tiene un próximo pesaje programado hasta
   * esa fecha y que todavía no se volvieron a pesar.
   */
  findPending(until: string): Promise<PendingWeighing[]>;
  save(weighing: AnimalWeighing): Promise<void>;
  /** Guarda varios en una sola transacción. */
  saveMany(weighings: AnimalWeighing[]): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
}

export const ANIMAL_WEIGHING_REPOSITORY = Symbol('IAnimalWeighingRepository');
