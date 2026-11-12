import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { toDateOnly } from '@shared/domain/date-only';
import {
  GeneticCategory,
  Sex,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import { Animal } from '@modules/animals/domain/models/animal.model';
import {
  addDays,
  assertAnimalEventDate,
} from '@modules/animals/domain/models/animal-event-date';
import {
  GESTATION_DAYS,
  MAX_LITTER_SIZE,
  MAX_SERVICE_DAYS,
  PregnancyCheckMethod,
  PregnancyCheckResult,
  ServiceStatus,
  ServiceType,
} from '../enums/reproduction.enums';
import { BreedingAnimalRef, toBreedingRef } from './breeding-animal-ref';

export interface PregnancyCheck {
  id: string;
  /** YYYY-MM-DD */
  checkedAt: string;
  method: PregnancyCheckMethod;
  result: PregnancyCheckResult;
  /** Fetos vistos en la ecografía (solo si está preñada). */
  fetusCount: number | null;
  notes: string | null;
  audit: AuditInfo;
}

/** Usuario que registró la monta en el sistema (se toma de la auditoría). */
export interface ServiceRegistrar {
  id: string;
  username: string;
  fullName: string;
}

/** Autorización de una monta entre animales emparentados. */
export interface KinshipOverride {
  reason: string;
  authorizedBy: string;
  authorizedAt: Date;
}

export interface Abortion {
  /** YYYY-MM-DD */
  date: string;
  cause: string | null;
}

export interface BreedingServiceProps {
  id: string;
  dam: BreedingAnimalRef;
  sire: BreedingAnimalRef;
  species: Species;
  type: ServiceType;
  /** Fecha de ingreso: el día en que se juntó la pareja (YYYY-MM-DD). */
  serviceDate: string;
  /** Fecha de salida: la monta puede durar varios días (YYYY-MM-DD). */
  exitDate: string | null;
  /** Código de la pajuela (inseminación artificial). */
  strawCode: string | null;
  expectedBirthDate: string;
  status: ServiceStatus;
  /** Coeficiente de consanguinidad que tendría la cría (0 a 1). */
  inbreedingCoefficient: number;
  kinshipOverride: KinshipOverride | null;
  /** Categoría que tendría la cría, calculada al registrar la monta. */
  expectedOffspringCategory: GeneticCategory | null;
  abortion: Abortion | null;
  checks: PregnancyCheck[];
  notes: string | null;
  audit: AuditInfo;
  /** Quién la registró. Solo lectura: lo llena el repositorio. */
  registeredBy?: ServiceRegistrar | null;
}

/**
 * Reglas de la pareja que no dependen de otras filas: sexo, especie, que la
 * hembra estuviera en la cabaña esa fecha y que la inseminación sea con semen
 * de un reproductor externo.
 */
export function assertBreedingPair(
  dam: Animal,
  sire: Animal,
  type: ServiceType,
  serviceDate: string,
  now: Date,
): void {
  if (dam.getSex() !== Sex.FEMALE) {
    throw new DomainError('La madre de la monta debe ser una hembra');
  }
  if (sire.getSex() !== Sex.MALE) {
    throw new DomainError('El padre de la monta debe ser un macho');
  }
  if (dam.getSpecies() !== sire.getSpecies()) {
    throw new DomainError('La hembra y el macho deben ser de la misma especie');
  }
  if (dam.getIsExternal()) {
    throw new DomainError(
      'La hembra debe ser de la cabaña: los animales externos no tienen montas registradas',
    );
  }
  assertAnimalEventDate(dam, serviceDate, 'La fecha de la monta', now);

  if (type === ServiceType.ARTIFICIAL_INSEMINATION && !sire.getIsExternal()) {
    throw new DomainError(
      'La inseminación artificial es con semen de un reproductor externo. Registre al donante como animal externo.',
    );
  }
  if (sire.getIsExternal()) {
    const birthDate = sire.getBirthDate();
    if (birthDate && serviceDate < birthDate) {
      throw new DomainError(
        `La fecha de la monta no puede ser anterior al nacimiento del macho (${birthDate})`,
      );
    }
  } else {
    assertAnimalEventDate(sire, serviceDate, 'La fecha de la monta', now);
  }
}

export class BreedingService {
  constructor(private readonly props: BreedingServiceProps) {}

  static create(params: {
    dam: Animal;
    sire: Animal;
    type: ServiceType;
    serviceDate: string;
    exitDate?: string | null;
    strawCode?: string | null;
    notes?: string | null;
    inbreedingCoefficient: number;
    kinshipOverride: KinshipOverride | null;
    expectedOffspringCategory: GeneticCategory | null;
    createdBy: string;
    now: Date;
  }): BreedingService {
    assertBreedingPair(
      params.dam,
      params.sire,
      params.type,
      params.serviceDate,
      params.now,
    );
    const species = params.dam.getSpecies();
    const service = new BreedingService({
      id: new UUID().getValue(),
      dam: toBreedingRef(params.dam),
      sire: toBreedingRef(params.sire),
      species,
      type: params.type,
      serviceDate: params.serviceDate,
      exitDate: null,
      strawCode: null,
      expectedBirthDate: addDays(params.serviceDate, GESTATION_DAYS[species]),
      status: ServiceStatus.PENDING,
      inbreedingCoefficient: params.inbreedingCoefficient,
      kinshipOverride: params.kinshipOverride,
      expectedOffspringCategory: params.expectedOffspringCategory,
      abortion: null,
      checks: [],
      notes: null,
      audit: newAuditInfo(params.createdBy),
    });
    service.applyDetails(params);
    service.applyExitDate(params.exitDate ?? null, params.now);
    return service;
  }

  // ---------- Getters ----------

  public getId(): string {
    return this.props.id;
  }
  public getDam(): BreedingAnimalRef {
    return this.props.dam;
  }
  public getSire(): BreedingAnimalRef {
    return this.props.sire;
  }
  public getSpecies(): Species {
    return this.props.species;
  }
  public getType(): ServiceType {
    return this.props.type;
  }
  public getServiceDate(): string {
    return this.props.serviceDate;
  }
  public getExitDate(): string | null {
    return this.props.exitDate;
  }
  public getStrawCode(): string | null {
    return this.props.strawCode;
  }
  public getRegisteredBy(): ServiceRegistrar | null {
    return this.props.registeredBy ?? null;
  }
  public getExpectedBirthDate(): string {
    return this.props.expectedBirthDate;
  }
  public getStatus(): ServiceStatus {
    return this.props.status;
  }
  public getInbreedingCoefficient(): number {
    return this.props.inbreedingCoefficient;
  }
  public getKinshipOverride(): KinshipOverride | null {
    return this.props.kinshipOverride;
  }
  public getExpectedOffspringCategory(): GeneticCategory | null {
    return this.props.expectedOffspringCategory;
  }
  public getAbortion(): Abortion | null {
    return this.props.abortion;
  }
  /** Del más antiguo al más reciente. */
  public getChecks(): PregnancyCheck[] {
    return [...this.props.checks];
  }
  public getNotes(): string | null {
    return this.props.notes;
  }
  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  /** Fetos del último diagnóstico positivo, si la ecografía los contó. */
  public getExpectedFetusCount(): number | null {
    const last = this.props.checks.at(-1);
    return last?.result === PregnancyCheckResult.PREGNANT
      ? last.fetusCount
      : null;
  }

  // ---------- Edición ----------

  /** Corrige la fecha y los datos descriptivos. La pareja no cambia. */
  public update(
    changes: {
      serviceDate?: string;
      exitDate?: string | null;
      strawCode?: string | null;
      notes?: string | null;
    },
    dam: Animal,
    sire: Animal,
    now: Date,
  ): void {
    if (
      changes.serviceDate !== undefined &&
      changes.serviceDate !== this.props.serviceDate
    ) {
      this.assertEditable('cambiar la fecha');
      assertBreedingPair(dam, sire, this.props.type, changes.serviceDate, now);
      const first = this.props.checks[0];
      if (first && first.checkedAt < changes.serviceDate) {
        throw new DomainError(
          `La fecha de la monta no puede ser posterior a su primer diagnóstico (${first.checkedAt})`,
        );
      }
      if (
        this.props.abortion &&
        this.props.abortion.date < changes.serviceDate
      ) {
        throw new DomainError(
          `La fecha de la monta no puede ser posterior al aborto (${this.props.abortion.date})`,
        );
      }
      this.props.serviceDate = changes.serviceDate;
      this.props.expectedBirthDate = addDays(
        changes.serviceDate,
        GESTATION_DAYS[this.props.species],
      );
    }
    // También valida la salida vigente contra una nueva fecha de ingreso.
    this.applyExitDate(
      changes.exitDate !== undefined ? changes.exitDate : this.props.exitDate,
      now,
    );
    this.applyDetails(changes);
  }

  public addCheck(
    data: {
      checkedAt: string;
      method: PregnancyCheckMethod;
      result: PregnancyCheckResult;
      fetusCount?: number | null;
      notes?: string | null;
    },
    createdBy: string,
    now: Date,
  ): PregnancyCheck {
    this.assertEditable('registrar un diagnóstico');
    assertDate(data.checkedAt, this.props.serviceDate, 'del diagnóstico', now);
    const fetusCount = data.fetusCount ?? null;
    if (fetusCount !== null) {
      if (data.result !== PregnancyCheckResult.PREGNANT) {
        throw new DomainError(
          'El número de fetos solo se indica si está preñada',
        );
      }
      if (
        !Number.isInteger(fetusCount) ||
        fetusCount < 1 ||
        fetusCount > MAX_LITTER_SIZE
      ) {
        throw new DomainError(
          `El número de fetos va de 1 a ${MAX_LITTER_SIZE}`,
        );
      }
    }
    const check: PregnancyCheck = {
      id: new UUID().getValue(),
      checkedAt: data.checkedAt,
      method: data.method,
      result: data.result,
      fetusCount,
      notes: data.notes?.trim() || null,
      audit: newAuditInfo(createdBy),
    };
    this.props.checks.push(check);
    this.props.checks.sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
    this.refreshStatus();
    return check;
  }

  public removeCheck(checkId: string): void {
    this.assertEditable('eliminar un diagnóstico');
    const index = this.props.checks.findIndex((c) => c.id === checkId);
    if (index < 0) {
      throw new DomainError('El diagnóstico no pertenece a esta monta');
    }
    this.props.checks.splice(index, 1);
    this.refreshStatus();
  }

  public recordAbortion(abortion: Abortion, now: Date): void {
    if (this.props.status === ServiceStatus.BIRTHED) {
      throw new DomainError('La monta ya tiene un parto registrado');
    }
    if (this.props.abortion) {
      throw new DomainError('La monta ya tiene un aborto registrado');
    }
    assertDate(abortion.date, this.props.serviceDate, 'del aborto', now);
    const last = this.props.checks.at(-1);
    if (last && last.checkedAt > abortion.date) {
      throw new DomainError(
        `La fecha del aborto no puede ser anterior al último diagnóstico (${last.checkedAt})`,
      );
    }
    this.props.abortion = {
      date: abortion.date,
      cause: abortion.cause?.trim() || null,
    };
    this.refreshStatus();
  }

  /** Corrige un aborto registrado por error. */
  public cancelAbortion(): void {
    if (!this.props.abortion) {
      throw new DomainError('La monta no tiene un aborto registrado');
    }
    this.props.abortion = null;
    this.refreshStatus();
  }

  /** Lo llama el registro del parto. */
  public markBirthed(birthDate: string): void {
    if (this.props.status === ServiceStatus.BIRTHED) {
      throw new DomainError('La monta ya tiene un parto registrado');
    }
    if (this.props.abortion) {
      throw new DomainError(
        'La monta tiene un aborto registrado: anúlelo antes de registrar el parto',
      );
    }
    if (birthDate < this.props.serviceDate) {
      throw new DomainError(
        `El parto no puede ser anterior a la monta (${this.props.serviceDate})`,
      );
    }
    this.props.status = ServiceStatus.BIRTHED;
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }

  private applyExitDate(exitDate: string | null, now: Date): void {
    if (exitDate !== null) {
      if (exitDate > toDateOnly(now)) {
        throw new DomainError('La fecha de salida no puede ser futura');
      }
      if (exitDate < this.props.serviceDate) {
        throw new DomainError(
          `La fecha de salida no puede ser anterior a la de ingreso (${this.props.serviceDate})`,
        );
      }
      if (exitDate > addDays(this.props.serviceDate, MAX_SERVICE_DAYS)) {
        throw new DomainError(
          `La monta no puede durar más de ${MAX_SERVICE_DAYS} días: revise la fecha de salida`,
        );
      }
    }
    this.props.exitDate = exitDate;
  }

  private applyDetails(changes: {
    strawCode?: string | null;
    notes?: string | null;
  }): void {
    const p = this.props;
    if (changes.strawCode !== undefined) {
      p.strawCode = changes.strawCode?.trim().toUpperCase() || null;
    }
    if (changes.notes !== undefined) p.notes = changes.notes?.trim() || null;
    if (p.strawCode && p.type !== ServiceType.ARTIFICIAL_INSEMINATION) {
      throw new DomainError(
        'El código de pajuela solo corresponde a la inseminación artificial',
      );
    }
  }

  private assertEditable(action: string): void {
    if (this.props.status === ServiceStatus.BIRTHED) {
      throw new DomainError(
        `No se puede ${action}: la monta ya tiene un parto registrado`,
      );
    }
    if (this.props.abortion) {
      throw new DomainError(
        `No se puede ${action}: la monta tiene un aborto registrado`,
      );
    }
  }

  private refreshStatus(): void {
    const p = this.props;
    if (p.status === ServiceStatus.BIRTHED) return;
    if (p.abortion) {
      p.status = ServiceStatus.ABORTED;
      return;
    }
    const last = p.checks.at(-1);
    p.status = !last
      ? ServiceStatus.PENDING
      : last.result === PregnancyCheckResult.PREGNANT
        ? ServiceStatus.PREGNANT
        : ServiceStatus.EMPTY;
  }
}

function assertDate(
  date: string,
  serviceDate: string,
  label: string,
  now: Date,
): void {
  if (date > toDateOnly(now)) {
    throw new DomainError(`La fecha ${label} no puede ser futura`);
  }
  if (date < serviceDate) {
    throw new DomainError(
      `La fecha ${label} no puede ser anterior a la monta (${serviceDate})`,
    );
  }
}
