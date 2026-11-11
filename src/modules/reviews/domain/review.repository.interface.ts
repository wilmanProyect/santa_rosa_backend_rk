import type { Paginated, PaginationParams } from '@shared/domain/paginated';
import type {
  DataReview,
  ReviewCategory,
  ReviewEntityType,
  ReviewStatus,
  ReviewTarget,
} from './review.model';

export const REVIEW_REPOSITORY = Symbol('REVIEW_REPOSITORY');

export interface ReviewFilters {
  status?: ReviewStatus;
  category?: ReviewCategory;
  entityType?: ReviewEntityType;
  entityId?: string;
  search?: string;
}

/** Datos para mostrar un registro asociado sin otra consulta. */
export interface ReviewTargetSummary {
  entityType: ReviewEntityType;
  entityId: string;
  /** Texto corto, por ejemplo "CSR-12 FOEMA" o "Parto de 55 JADE · 2025-09-13". */
  label: string;
  /** false si el registro fue eliminado. */
  exists: boolean;
}

export interface IReviewRepository {
  findById(id: string): Promise<DataReview | null>;
  findPaginated(
    filters: ReviewFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<DataReview>>;
  save(review: DataReview): Promise<void>;
  /** Registros de la lista que no existen (o están eliminados). */
  findMissingTargets(targets: ReviewTarget[]): Promise<ReviewTarget[]>;
  describeTargets(targets: ReviewTarget[]): Promise<ReviewTargetSummary[]>;
  /** Registros de un tipo con avisos pendientes, para marcarlos en los listados. */
  openTargetCounts(
    entityType: ReviewEntityType,
  ): Promise<{ entityId: string; count: number }[]>;
  countOpen(): Promise<number>;
}
