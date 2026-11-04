import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { Animal } from './animal.model';
import { assertAnimalEventDate, daysBetween } from './animal-event-date';

/** Motivo del pesaje. */
export enum WeighingType {
  /** Peso al nacer */
  BIRTH = 'BIRTH',
  /** Destete */
  WEANING = 'WEANING',
  /** Control periódico */
  ROUTINE = 'ROUTINE',
  /** Selección de reproductores */
  SELECTION = 'SELECTION',
  /** Ingreso a la cabaña (compra) */
  ENTRY = 'ENTRY',
  /** Venta */
  SALE = 'SALE',
  OTHER = 'OTHER',
}

/** Tipos que solo pueden registrarse una vez por animal. */
export const SINGLE_WEIGHING_TYPES = [WeighingType.BIRTH, WeighingType.WEANING];

/** El peso al nacer debe tomarse dentro de estos días desde el nacimiento. */
export const BIRTH_WEIGHING_MAX_DAYS = 7;

export const MAX_WEIGHT_KG = 999.99;

export interface WeighingData {
  /** YYYY-MM-DD */
  weighedAt: string;
  weightKg: number;
  type: WeighingType;
  /** Condición corporal, de 1 a 5 en pasos de 0,5. */
  bodyConditionScore: number | null;
  /** Peso aproximado (cinta, a ojo) en lugar de balanza. */
  isEstimated: boolean;
  /** Próximo pesaje programado (genera un recordatorio). */
  nextWeighingAt: string | null;
  notes: string | null;
}

export interface AnimalWeighingProps extends WeighingData {
  id: string;
  animalId: string;
  audit: AuditInfo;
}

export class AnimalWeighing {
  constructor(private readonly props: AnimalWeighingProps) {}

  static create(params: {
    animal: Animal;
    data: Pick<WeighingData, 'weighedAt' | 'weightKg' | 'type'> &
      Partial<WeighingData>;
    createdBy: string | null;
    now: Date;
  }): AnimalWeighing {
    const weighing = new AnimalWeighing({
      id: new UUID().getValue(),
      animalId: params.animal.getId(),
      weighedAt: params.data.weighedAt,
      weightKg: params.data.weightKg,
      type: params.data.type,
      bodyConditionScore: null,
      isEstimated: false,
      nextWeighingAt: null,
      notes: null,
      audit: newAuditInfo(params.createdBy),
    });
    weighing.update(params.data, params.animal, params.now);
    return weighing;
  }

  public getId(): string {
    return this.props.id;
  }
  public getAnimalId(): string {
    return this.props.animalId;
  }
  public getWeighedAt(): string {
    return this.props.weighedAt;
  }
  public getWeightKg(): number {
    return this.props.weightKg;
  }
  public getType(): WeighingType {
    return this.props.type;
  }
  public getBodyConditionScore(): number | null {
    return this.props.bodyConditionScore;
  }
  public getIsEstimated(): boolean {
    return this.props.isEstimated;
  }
  public getNextWeighingAt(): string | null {
    return this.props.nextWeighingAt;
  }
  public getNotes(): string | null {
    return this.props.notes;
  }
  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  /** Aplica solo los campos definidos y valida contra el animal. */
  public update(
    changes: Partial<WeighingData>,
    animal: Animal,
    now: Date,
  ): void {
    const p = this.props;
    if (changes.weighedAt !== undefined) p.weighedAt = changes.weighedAt;
    if (changes.weightKg !== undefined) p.weightKg = changes.weightKg;
    if (changes.type !== undefined) p.type = changes.type;
    if (changes.bodyConditionScore !== undefined) {
      p.bodyConditionScore = changes.bodyConditionScore;
    }
    if (changes.isEstimated !== undefined) p.isEstimated = changes.isEstimated;
    if (changes.nextWeighingAt !== undefined) {
      p.nextWeighingAt = changes.nextWeighingAt;
    }
    if (changes.notes !== undefined) p.notes = changes.notes?.trim() || null;

    assertAnimalEventDate(animal, p.weighedAt, 'La fecha del pesaje', now);
    if (!(p.weightKg > 0) || p.weightKg > MAX_WEIGHT_KG) {
      throw new DomainError(
        `El peso debe ser mayor a 0 y hasta ${MAX_WEIGHT_KG} kg`,
      );
    }
    if (
      p.bodyConditionScore !== null &&
      (p.bodyConditionScore < 1 ||
        p.bodyConditionScore > 5 ||
        (p.bodyConditionScore * 2) % 1 !== 0)
    ) {
      throw new DomainError(
        'La condición corporal va de 1 a 5, en pasos de 0,5',
      );
    }
    if (p.nextWeighingAt !== null && p.nextWeighingAt <= p.weighedAt) {
      throw new DomainError(
        'La fecha del próximo pesaje debe ser posterior a la del pesaje',
      );
    }
    const birthDate = animal.getBirthDate();
    if (
      p.type === WeighingType.BIRTH &&
      birthDate &&
      daysBetween(birthDate, p.weighedAt) > BIRTH_WEIGHING_MAX_DAYS
    ) {
      throw new DomainError(
        `El peso al nacer debe registrarse dentro de los ${BIRTH_WEIGHING_MAX_DAYS} días posteriores al nacimiento (${birthDate})`,
      );
    }
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }
}

/**
 * Advertencias que no impiden guardar, pero conviene confirmar: suelen ser
 * errores de tipeo en la balanza o en el arete.
 */
export function weighingWarnings(
  weighing: AnimalWeighing,
  previous: AnimalWeighing | null,
): string[] {
  if (!previous) return [];
  const days = daysBetween(previous.getWeighedAt(), weighing.getWeighedAt());
  const change = weighing.getWeightKg() - previous.getWeightKg();
  const warnings: string[] = [];
  if (change < 0 && -change / previous.getWeightKg() > 0.15) {
    warnings.push(
      `Bajó ${Math.round((-change / previous.getWeightKg()) * 100)} % desde el pesaje del ${previous.getWeighedAt()} (${previous.getWeightKg()} kg). Verifique el dato.`,
    );
  }
  if (days > 0 && change > 0 && (change * 1000) / days > MAX_DAILY_GAIN_G) {
    warnings.push(
      `Ganancia de ${Math.round((change * 1000) / days)} g/día desde el pesaje del ${previous.getWeighedAt()}: inusualmente alta. Verifique el dato.`,
    );
  }
  return warnings;
}

/** Ganancia diaria por encima de la cual se pide verificar (ovinos y caprinos). */
export const MAX_DAILY_GAIN_G = 600;
