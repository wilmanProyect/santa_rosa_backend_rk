import { Breed } from '../models/breed.model';
import { Species } from '../enums/animal.enums';

export interface BreedFilters {
  species?: Species;
  isActive?: boolean;
}

export interface IBreedRepository {
  findById(id: string): Promise<Breed | null>;
  /** Búsqueda exacta sin distinguir mayúsculas. */
  findByName(species: Species, name: string): Promise<Breed | null>;
  findAll(filters: BreedFilters): Promise<Breed[]>;
  save(breed: Breed): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
  /** Animales (no eliminados) que tienen esta raza. */
  countAnimals(id: string): Promise<number>;
}

export const BREED_REPOSITORY = Symbol('IBreedRepository');
