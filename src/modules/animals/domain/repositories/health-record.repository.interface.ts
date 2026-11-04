import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { HealthEventType, HealthRecord } from '../models/health-record.model';

export interface HealthRecordFilters {
  animalId?: string;
  /** true: solo eventos generales (sin animal). */
  generalOnly?: boolean;
  types?: HealthEventType[];
  productId?: string;
  targetCondition?: string;
  from?: string;
  to?: string;
}

export interface ActiveWithdrawal {
  /** Desde esta fecha ya se puede faenar / usar la leche. */
  endsOn: string;
  productName: string;
  appliedAt: string;
}

export interface PendingDose {
  recordId: string;
  animalId: string | null;
  earTag: string | null;
  name: string | null;
  type: HealthEventType;
  productName: string | null;
  targetCondition: string | null;
  location: string | null;
  lastAppliedAt: string;
  nextDoseAt: string;
}

export interface IHealthRecordRepository {
  findById(id: string): Promise<HealthRecord | null>;
  findPaginated(
    filters: HealthRecordFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<HealthRecord>>;
  /** Retiro de carne y de leche vigente en esa fecha (el que termina más tarde). */
  findActiveWithdrawal(
    animalId: string,
    onDate: string,
  ): Promise<{ meat: ActiveWithdrawal | null; milk: ActiveWithdrawal | null }>;
  /**
   * Próximas dosis programadas hasta esa fecha que todavía no se aplicaron
   * (no hay un evento posterior del mismo tipo para ese animal o lugar).
   */
  findPendingDoses(until: string): Promise<PendingDose[]>;
  save(record: HealthRecord): Promise<void>;
  saveMany(records: HealthRecord[]): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
}

export const HEALTH_RECORD_REPOSITORY = Symbol('IHealthRecordRepository');
