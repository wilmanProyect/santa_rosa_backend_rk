import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { toDateOnly } from '@shared/domain/date-only';
import { GeneticCategory } from '../enums/animal.enums';

/** Origen de un cambio de categoría genética. */
export enum GeneticCategoryChangeKind {
  /** Calculada al registrar el parto, según la categoría de los padres. */
  EXPECTED_AT_BIRTH = 'EXPECTED_AT_BIRTH',
  /** Confirmada (o corregida) por ABSID. */
  CONFIRMED = 'CONFIRMED',
  /** Editada a mano en la ficha del animal. */
  MANUAL = 'MANUAL',
}

/** Una fila del historial de categoría genética de un animal. */
export interface GeneticCategoryChange {
  id: string;
  animalId: string;
  fromCategory: GeneticCategory | null;
  toCategory: GeneticCategory | null;
  kind: GeneticCategoryChangeKind;
  /** YYYY-MM-DD */
  changedOn: string;
  absidCertificateCode: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: Date | null;
}

export function newGeneticCategoryChange(params: {
  animalId: string;
  fromCategory: GeneticCategory | null;
  toCategory: GeneticCategory | null;
  kind: GeneticCategoryChangeKind;
  changedOn?: string;
  absidCertificateCode?: string | null;
  notes?: string | null;
  createdBy: string | null;
}): GeneticCategoryChange {
  return {
    id: new UUID().getValue(),
    animalId: params.animalId,
    fromCategory: params.fromCategory,
    toCategory: params.toCategory,
    kind: params.kind,
    changedOn: params.changedOn ?? toDateOnly(new Date()),
    absidCertificateCode: params.absidCertificateCode?.trim() || null,
    notes: params.notes?.trim() || null,
    createdBy: params.createdBy,
    createdAt: null,
  };
}
