import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { toDateOnly } from '@shared/domain/date-only';
import {
  AdministrationRoute,
  DoseUnit,
} from '@modules/veterinary/domain/enums/veterinary.enums';
import { VeterinaryProduct } from '@modules/veterinary/domain/models/veterinary-product.model';
import { Species } from '../enums/animal.enums';
import { Animal } from './animal.model';
import { addDays, assertAnimalEventDate } from './animal-event-date';

export enum HealthEventType {
  // Sanitario
  VACCINATION = 'VACCINATION',
  INTERNAL_DEWORMING = 'INTERNAL_DEWORMING',
  /** Baño o desparasitación externa */
  EXTERNAL_DEWORMING = 'EXTERNAL_DEWORMING',
  VITAMINS_MINERALS = 'VITAMINS_MINERALS',
  TREATMENT = 'TREATMENT',
  /** Diagnóstico o examen: ecografía, palpación, laboratorio */
  DIAGNOSIS = 'DIAGNOSIS',
  // Manejo
  SHEARING = 'SHEARING',
  HOOF_TRIMMING = 'HOOF_TRIMMING',
  /** Castración, descorne, curación, etc. */
  OTHER_PROCEDURE = 'OTHER_PROCEDURE',
  // Instalaciones (evento general, sin animal)
  CORRAL_CLEANING = 'CORRAL_CLEANING',
}

export enum HealthCategory {
  SANITARY = 'SANITARY',
  MANAGEMENT = 'MANAGEMENT',
  /** Instalaciones: evento general, no asociado a un animal. */
  FACILITY = 'FACILITY',
}

export const HEALTH_EVENT_CATEGORY: Record<HealthEventType, HealthCategory> = {
  [HealthEventType.VACCINATION]: HealthCategory.SANITARY,
  [HealthEventType.INTERNAL_DEWORMING]: HealthCategory.SANITARY,
  [HealthEventType.EXTERNAL_DEWORMING]: HealthCategory.SANITARY,
  [HealthEventType.VITAMINS_MINERALS]: HealthCategory.SANITARY,
  [HealthEventType.TREATMENT]: HealthCategory.SANITARY,
  [HealthEventType.DIAGNOSIS]: HealthCategory.SANITARY,
  [HealthEventType.SHEARING]: HealthCategory.MANAGEMENT,
  [HealthEventType.HOOF_TRIMMING]: HealthCategory.MANAGEMENT,
  [HealthEventType.OTHER_PROCEDURE]: HealthCategory.MANAGEMENT,
  [HealthEventType.CORRAL_CLEANING]: HealthCategory.FACILITY,
};

export const typesOfCategory = (category: HealthCategory) =>
  (Object.keys(HEALTH_EVENT_CATEGORY) as HealthEventType[]).filter(
    (t) => HEALTH_EVENT_CATEGORY[t] === category,
  );

/** Producto aplicado, con los días de retiro vigentes al momento de aplicarlo. */
export interface AppliedProduct {
  id: string;
  name: string;
  meatWithdrawalDays: number;
  milkWithdrawalDays: number | null;
}

export interface HealthRecordData {
  type: HealthEventType;
  /** YYYY-MM-DD */
  appliedAt: string;
  /** La fecha no es exacta (p. ej. no se anotó en la planilla original). */
  isDateEstimated: boolean;
  productBatch: string | null;
  doseQuantity: number | null;
  doseUnit: DoseUnit | null;
  route: AdministrationRoute | null;
  /** Enfermedad que se previene o se trata (Clostridiosis, neumonía...). */
  targetCondition: string | null;
  /** Veterinario o persona responsable. */
  appliedBy: string | null;
  /** Corral o lugar (sobre todo en eventos generales). */
  location: string | null;
  /** Próxima dosis o refuerzo (genera un recordatorio). */
  nextDoseAt: string | null;
  cost: number | null;
  notes: string | null;
}

export interface HealthRecordProps extends HealthRecordData {
  id: string;
  /** Nulo en los eventos generales (instalaciones). */
  animalId: string | null;
  product: AppliedProduct | null;
  audit: AuditInfo;
}

export class HealthRecord {
  constructor(private readonly props: HealthRecordProps) {}

  static create(params: {
    animal: Animal | null;
    product: VeterinaryProduct | null;
    data: Pick<HealthRecordData, 'type' | 'appliedAt'> &
      Partial<HealthRecordData>;
    createdBy: string | null;
    now: Date;
  }): HealthRecord {
    const record = new HealthRecord({
      id: new UUID().getValue(),
      animalId: params.animal?.getId() ?? null,
      type: params.data.type,
      appliedAt: params.data.appliedAt,
      isDateEstimated: false,
      product: null,
      productBatch: null,
      doseQuantity: null,
      doseUnit: null,
      route: null,
      targetCondition: null,
      appliedBy: null,
      location: null,
      nextDoseAt: null,
      cost: null,
      notes: null,
      audit: newAuditInfo(params.createdBy),
    });
    record.update(
      { ...params.data, product: params.product },
      params.animal,
      params.now,
    );
    return record;
  }

  public getId(): string {
    return this.props.id;
  }
  public getAnimalId(): string | null {
    return this.props.animalId;
  }
  public getType(): HealthEventType {
    return this.props.type;
  }
  public getCategory(): HealthCategory {
    return HEALTH_EVENT_CATEGORY[this.props.type];
  }
  public getAppliedAt(): string {
    return this.props.appliedAt;
  }
  public getIsDateEstimated(): boolean {
    return this.props.isDateEstimated;
  }
  public getProduct(): AppliedProduct | null {
    return this.props.product;
  }
  public getProductBatch(): string | null {
    return this.props.productBatch;
  }
  public getDoseQuantity(): number | null {
    return this.props.doseQuantity;
  }
  public getDoseUnit(): DoseUnit | null {
    return this.props.doseUnit;
  }
  public getRoute(): AdministrationRoute | null {
    return this.props.route;
  }
  public getTargetCondition(): string | null {
    return this.props.targetCondition;
  }
  public getAppliedBy(): string | null {
    return this.props.appliedBy;
  }
  public getLocation(): string | null {
    return this.props.location;
  }
  public getNextDoseAt(): string | null {
    return this.props.nextDoseAt;
  }
  public getCost(): number | null {
    return this.props.cost;
  }
  public getNotes(): string | null {
    return this.props.notes;
  }
  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  /** Desde esta fecha ya se puede faenar (o usar la leche). Nulo si no hay retiro. */
  public getMeatWithdrawalEndsOn(): string | null {
    const days = this.props.product?.meatWithdrawalDays ?? 0;
    return days > 0 ? addDays(this.props.appliedAt, days) : null;
  }
  public getMilkWithdrawalEndsOn(): string | null {
    const days = this.props.product?.milkWithdrawalDays ?? 0;
    return days > 0 ? addDays(this.props.appliedAt, days) : null;
  }

  /** Aplica solo los campos definidos. `product: null` quita el producto. */
  public update(
    changes: Partial<HealthRecordData> & { product?: VeterinaryProduct | null },
    animal: Animal | null,
    now: Date,
  ): void {
    const p = this.props;
    if (changes.type !== undefined) p.type = changes.type;
    if (changes.appliedAt !== undefined) p.appliedAt = changes.appliedAt;
    if (changes.isDateEstimated !== undefined) {
      p.isDateEstimated = changes.isDateEstimated;
    }
    if (changes.product !== undefined) {
      if (changes.product && animal) {
        assertProductForSpecies(changes.product, animal.getSpecies());
      }
      p.product = changes.product
        ? {
            id: changes.product.getId(),
            name: changes.product.getName(),
            meatWithdrawalDays: changes.product.getMeatWithdrawalDays(),
            milkWithdrawalDays: changes.product.getMilkWithdrawalDays(),
          }
        : null;
    }
    if (changes.productBatch !== undefined)
      p.productBatch = text(changes.productBatch);
    if (changes.doseQuantity !== undefined)
      p.doseQuantity = changes.doseQuantity;
    if (changes.doseUnit !== undefined) p.doseUnit = changes.doseUnit;
    if (changes.route !== undefined) p.route = changes.route;
    if (changes.targetCondition !== undefined) {
      p.targetCondition = text(changes.targetCondition);
    }
    if (changes.appliedBy !== undefined) p.appliedBy = text(changes.appliedBy);
    if (changes.location !== undefined) p.location = text(changes.location);
    if (changes.nextDoseAt !== undefined) p.nextDoseAt = changes.nextDoseAt;
    if (changes.cost !== undefined) p.cost = changes.cost;
    if (changes.notes !== undefined) p.notes = text(changes.notes);

    const isFacility =
      HEALTH_EVENT_CATEGORY[p.type] === HealthCategory.FACILITY;
    if (isFacility && p.animalId) {
      throw new DomainError(
        'Los eventos de instalaciones (p. ej. limpieza de corral) son generales: no se asocian a un animal',
      );
    }
    if (!isFacility && !p.animalId) {
      throw new DomainError(
        'Indique el animal del evento sanitario o de manejo',
      );
    }
    if (animal) {
      assertAnimalEventDate(animal, p.appliedAt, 'La fecha del evento', now);
    } else if (p.appliedAt > toDateOnly(now)) {
      throw new DomainError('La fecha del evento no puede ser futura');
    }
    if ((p.doseQuantity === null) !== (p.doseUnit === null)) {
      throw new DomainError('Indique la dosis junto con su unidad');
    }
    if (p.doseQuantity !== null && !(p.doseQuantity > 0)) {
      throw new DomainError('La dosis debe ser mayor a 0');
    }
    if (p.cost !== null && p.cost < 0) {
      throw new DomainError('El costo no puede ser negativo');
    }
    if (p.nextDoseAt !== null && p.nextDoseAt <= p.appliedAt) {
      throw new DomainError(
        'La fecha de la próxima dosis debe ser posterior a la del evento',
      );
    }
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }
}

function assertProductForSpecies(product: VeterinaryProduct, species: Species) {
  const allowed =
    species === Species.SHEEP ? product.getForSheep() : product.getForGoats();
  if (!allowed) {
    throw new DomainError(
      `El producto "${product.getName()}" no está autorizado para ${species === Species.SHEEP ? 'ovinos' : 'caprinos'}`,
    );
  }
}

function text(value: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}
