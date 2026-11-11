import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { Animal } from '../models/animal.model';
import { GeneticCategoryChange } from '../models/genetic-category-change';
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

/** Parto (módulo de reproducción) en el que nació el animal. */
export interface BirthLink {
  birthId: string;
  /** true: reconstruido de los datos anteriores (sin monta). */
  isHistorical: boolean;
  birthDate: string;
}

export interface SaveAnimalOptions {
  /**
   * Reubica la cría en el parto histórico que corresponde a su madre y fecha de
   * nacimiento (lo crea si no existe) y recalcula el padre de los partos
   * afectados. Se usa al corregir la madre, el padre o la fecha de nacimiento.
   */
  syncHistoricalBirth?: { actorId: string };
}

export interface IAnimalRepository {
  findById(id: string): Promise<Animal | null>;
  findPaginated(
    filters: AnimalFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<Animal>>;
  /**
   * Con `categoryChange`, guarda también esa fila del historial; con
   * `syncHistoricalBirth`, actualiza su parto histórico (misma transacción).
   */
  save(
    animal: Animal,
    categoryChange?: GeneticCategoryChange,
    options?: SaveAnimalOptions,
  ): Promise<void>;
  findBirthLink(id: string): Promise<BirthLink | null>;
  /** Historial de categoría genética, del más antiguo al más reciente. */
  findGeneticCategoryHistory(
    animalId: string,
  ): Promise<GeneticCategoryChange[]>;
  softDelete(id: string, actorId: string): Promise<void>;
  getOffspringStats(id: string): Promise<OffspringStats>;
  /** Montas y partos (módulo de reproducción) en los que es madre o padre. */
  countBreedingRecords(
    id: string,
  ): Promise<{ services: number; births: number }>;
  /**
   * Animales (no eliminados, distintos de `excludeId`) con ese arete o ese
   * registro ABSID. Los valores deben venir normalizados (mayúsculas).
   */
  /** Animales de la misma especie con ese arete o ese registro ABSID. */
  findIdentifierMatches(params: {
    species: Species;
    earTag: string | null;
    absidRegistry: string | null;
    excludeId: string;
  }): Promise<IdentifierMatch[]>;
  /** true si `candidateId` es cría, nieto, etc. de `ancestorId`. */
  isDescendant(ancestorId: string, candidateId: string): Promise<boolean>;
}

export const ANIMAL_REPOSITORY = Symbol('IAnimalRepository');
