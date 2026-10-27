import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { Animal } from '../models/animal.model';
import {
  AnimalStatus,
  GeneticCategory,
  Sex,
  Species,
} from '../enums/animal.enums';

export interface AnimalFilters {
  /** Busca en arete, nombre, registro ABSID y registro externo. */
  search?: string;
  /** false (por defecto): animales de la cabaña. true: animales externos. */
  isExternal: boolean;
  species?: Species;
  sex?: Sex;
  status?: AnimalStatus;
  geneticCategory?: GeneticCategory;
  breedId?: string;
  colorId?: string;
  /** Crías de este animal (como madre o como padre). */
  parentId?: string;
  /** true: solo los casos especiales (arete o ABSID repetido). */
  identifierException?: boolean;
}

/** Otro animal que ya usa el arete o el registro ABSID indicado. */
export interface IdentifierMatch {
  id: string;
  earTag: string | null;
  name: string | null;
  absidRegistry: string | null;
  isExternal: boolean;
  identifierException: boolean;
}

export interface OffspringStats {
  count: number;
  /** Fecha de nacimiento de la cría más antigua (YYYY-MM-DD). */
  earliestBirthDate: string | null;
}

export interface IAnimalRepository {
  findById(id: string): Promise<Animal | null>;
  findPaginated(
    filters: AnimalFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<Animal>>;
  save(animal: Animal): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
  getOffspringStats(id: string): Promise<OffspringStats>;
  /**
   * Animales (no eliminados, distintos de `excludeId`) con ese arete o ese
   * registro ABSID. Los valores deben venir normalizados (mayúsculas).
   */
  findIdentifierMatches(params: {
    earTag: string | null;
    absidRegistry: string | null;
    excludeId: string;
  }): Promise<IdentifierMatch[]>;
  /** true si `candidateId` es cría, nieto, etc. de `ancestorId`. */
  isDescendant(ancestorId: string, candidateId: string): Promise<boolean>;
}

export const ANIMAL_REPOSITORY = Symbol('IAnimalRepository');
