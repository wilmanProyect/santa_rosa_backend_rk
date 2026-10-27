import { AnimalColor } from '../models/animal-color.model';

export interface AnimalColorFilters {
  isActive?: boolean;
}

export interface IAnimalColorRepository {
  findById(id: string): Promise<AnimalColor | null>;
  /** Búsqueda exacta sin distinguir mayúsculas. */
  findByName(name: string): Promise<AnimalColor | null>;
  findAll(filters: AnimalColorFilters): Promise<AnimalColor[]>;
  save(color: AnimalColor): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
  /** Animales (no eliminados) que tienen este color. */
  countAnimals(id: string): Promise<number>;
}

export const ANIMAL_COLOR_REPOSITORY = Symbol('IAnimalColorRepository');
