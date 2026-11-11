import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { Species } from '@modules/animals/domain/enums/animal.enums';
import { Animal } from '@modules/animals/domain/models/animal.model';
import { AnimalWeighing } from '@modules/animals/domain/models/animal-weighing.model';
import { GeneticCategoryChange } from '@modules/animals/domain/models/genetic-category-change';
import { ServiceStatus, ServiceType } from '../enums/reproduction.enums';
import { BreedingService } from '../models/breeding-service.model';
import { Birth } from '../models/birth.model';
import { PedigreeNode } from '../kinship';

export interface ServiceFilters {
  status?: ServiceStatus;
  type?: ServiceType;
  species?: Species;
  /** Montas en las que el animal es la madre o el padre. */
  animalId?: string;
  damId?: string;
  sireId?: string;
  /** Fecha de la monta, YYYY-MM-DD. */
  from?: string;
  to?: string;
  /** Solo las autorizadas pese al parentesco. */
  kinshipOverride?: boolean;
}

export interface BirthFilters {
  species?: Species;
  animalId?: string;
  damId?: string;
  sireId?: string;
  from?: string;
  to?: string;
  /** Número de crías del parto. */
  litterSize?: number;
  isHistorical?: boolean;
}

export interface IBreedingServiceRepository {
  findById(id: string): Promise<BreedingService | null>;
  findPaginated(
    filters: ServiceFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<BreedingService>>;
  /** Monta abierta (sin diagnóstico o preñada) de la hembra, excluyendo una. */
  findOpenForDam(
    damId: string,
    excludeId: string | null,
  ): Promise<BreedingService | null>;
  /** Guarda la monta y sus diagnósticos (agregados o eliminados). */
  save(service: BreedingService, actorId: string): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
}

/** Todo lo que se escribe al registrar un parto, en una sola transacción. */
export interface BirthRegistration {
  birth: Birth;
  service: BreedingService | null;
  animals: Animal[];
  weighings: AnimalWeighing[];
  categoryChanges: GeneticCategoryChange[];
  actorId: string;
}

export interface IBirthRepository {
  findById(id: string): Promise<Birth | null>;
  findByService(serviceId: string): Promise<Birth | null>;
  findPaginated(
    filters: BirthFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<Birth>>;
  /** Partos de la madre entre esas fechas (inclusive). */
  findDamBirthsBetween(
    damId: string,
    from: string,
    to: string,
  ): Promise<Birth[]>;
  register(registration: BirthRegistration): Promise<void>;
  /** Solo los datos del parto (asistencia, observaciones). */
  save(birth: Birth): Promise<void>;
}

export interface SireStats {
  sire: { id: string; earTag: string | null; name: string | null };
  services: number;
  /** Montas con resultado conocido (no pendientes). */
  servicesWithResult: number;
  /** Montas que terminaron en preñez, parto o aborto. */
  conceptions: number;
  births: number;
  offspring: number;
  bornAlive: number;
}

export interface ReproductionStats {
  services: {
    total: number;
    byStatus: Record<ServiceStatus, number>;
    byType: Record<ServiceType, number>;
    withResult: number;
    conceptions: number;
    kinshipOverrides: number;
  };
  births: {
    total: number;
    historical: number;
    byLitterSize: Record<'1' | '2' | '3' | '4', number>;
    offspring: number;
    bornAlive: number;
    bornDead: number;
    /** Promedio de días entre partos consecutivos de la misma madre. */
    averageIntervalDays: number | null;
    intervalsCounted: number;
  };
  sires: SireStats[];
}

export interface StatsFilters {
  species?: Species;
  from?: string;
  to?: string;
}

export interface PendingPregnancyCheck {
  serviceId: string;
  dam: { id: string; earTag: string | null; name: string | null };
  sire: { id: string; earTag: string | null; name: string | null };
  serviceDate: string;
  /** Desde cuándo conviene diagnosticar (monta + 30 días). */
  checkFrom: string;
}

export interface UpcomingBirth {
  serviceId: string;
  dam: { id: string; earTag: string | null; name: string | null };
  sire: { id: string; earTag: string | null; name: string | null };
  serviceDate: string;
  status: ServiceStatus;
  expectedBirthDate: string;
  expectedFetusCount: number | null;
}

/** Consultas de lectura: genealogía, indicadores y recordatorios. */
export interface IReproductionQueryRepository {
  /**
   * Los animales indicados y sus ancestros hasta `generations` generaciones
   * (solo los no eliminados).
   */
  loadPedigree(ids: string[], generations: number): Promise<PedigreeNode[]>;
  stats(filters: StatsFilters): Promise<ReproductionStats>;
  /** Montas sin diagnóstico cuya fecha de diagnóstico llega hasta `until`. */
  pendingPregnancyChecks(until: string): Promise<PendingPregnancyCheck[]>;
  /** Montas abiertas con parto probable hasta `until` (incluye las atrasadas). */
  upcomingBirths(until: string): Promise<UpcomingBirth[]>;
}

export const BREEDING_SERVICE_REPOSITORY = Symbol('IBreedingServiceRepository');
export const BIRTH_REPOSITORY = Symbol('IBirthRepository');
export const REPRODUCTION_QUERY_REPOSITORY = Symbol(
  'IReproductionQueryRepository',
);
