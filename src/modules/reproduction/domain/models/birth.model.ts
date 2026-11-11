import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { Sex, Species } from '@modules/animals/domain/enums/animal.enums';
import { Animal } from '@modules/animals/domain/models/animal.model';
import {
  assertAnimalEventDate,
  daysBetween,
} from '@modules/animals/domain/models/animal-event-date';
import { MAX_WEIGHT_KG } from '@modules/animals/domain/models/animal-weighing.model';
import {
  BIRTH_WINDOW_DAYS,
  BirthAssistance,
  MAX_LITTER_SIZE,
  ServiceStatus,
} from '../enums/reproduction.enums';
import { BreedingService } from './breeding-service.model';
import {
  BreedingAnimalRef,
  describeAnimal,
  toBreedingRef,
} from './breeding-animal-ref';

/** Tipo de parto según el número de crías. */
export enum LitterType {
  SINGLE = 'SINGLE',
  TWINS = 'TWINS',
  TRIPLETS = 'TRIPLETS',
  QUADRUPLETS = 'QUADRUPLETS',
}

const LITTER_TYPES = [
  LitterType.SINGLE,
  LitterType.TWINS,
  LitterType.TRIPLETS,
  LitterType.QUADRUPLETS,
];

/** Peso al nacer por encima del cual se pide verificar el dato. */
const HIGH_BIRTH_WEIGHT_KG = 10;

export interface BirthOffspring {
  id: string;
  /** Orden de nacimiento dentro del parto (1, 2, 3...). */
  position: number;
  /** Puede no conocerse en una cría nacida muerta. */
  sex: Sex | null;
  bornAlive: boolean;
  birthWeightKg: number | null;
  /** Animal creado para la cría viva. Null en las nacidas muertas. */
  animal: { id: string; earTag: string | null; name: string | null } | null;
}

export interface BirthProps {
  id: string;
  serviceId: string | null;
  dam: BreedingAnimalRef;
  /** Null si no se conoce (parto sin monta registrada). */
  sire: BreedingAnimalRef | null;
  species: Species;
  /** YYYY-MM-DD */
  birthDate: string;
  assistance: BirthAssistance | null;
  /** Reconstruido de los datos anteriores al módulo (misma madre y fecha). */
  isHistorical: boolean;
  offspring: BirthOffspring[];
  notes: string | null;
  audit: AuditInfo;
}

export interface NewOffspring {
  sex: Sex | null;
  bornAlive: boolean;
  birthWeightKg: number | null;
}

export class Birth {
  constructor(private readonly props: BirthProps) {}

  /**
   * Valida el parto. Las crías vivas se crean después como animales y se
   * enlazan con linkOffspringAnimal.
   */
  static register(params: {
    dam: Animal;
    sire: Animal | null;
    service: BreedingService | null;
    birthDate: string;
    assistance: BirthAssistance | null;
    offspring: NewOffspring[];
    notes: string | null;
    createdBy: string;
    now: Date;
  }): Birth {
    const { dam, sire, service, birthDate } = params;
    if (dam.getSex() !== Sex.FEMALE) {
      throw new DomainError('La madre debe ser una hembra');
    }
    assertAnimalEventDate(dam, birthDate, 'La fecha del parto', params.now);
    if (sire) {
      if (sire.getSex() !== Sex.MALE) {
        throw new DomainError('El padre debe ser un macho');
      }
      if (sire.getSpecies() !== dam.getSpecies()) {
        throw new DomainError(
          'El padre debe ser de la misma especie que la madre',
        );
      }
      const sireBirth = sire.getBirthDate();
      if (sireBirth && sireBirth >= birthDate) {
        throw new DomainError('El padre debe haber nacido antes que las crías');
      }
    }
    if (service) {
      if (
        service.getDam().id !== dam.getId() ||
        service.getSire().id !== sire?.getId()
      ) {
        throw new DomainError('La madre y el padre deben ser los de la monta');
      }
      if (birthDate < service.getServiceDate()) {
        throw new DomainError(
          `El parto no puede ser anterior a la monta (${service.getServiceDate()})`,
        );
      }
    }

    const count = params.offspring.length;
    if (count < 1 || count > MAX_LITTER_SIZE) {
      throw new DomainError(
        `Un parto tiene de 1 a ${MAX_LITTER_SIZE} crías (incluidas las nacidas muertas)`,
      );
    }
    params.offspring.forEach((o, i) => {
      if (o.bornAlive && !o.sex) {
        throw new DomainError(`Indique el sexo de la cría ${i + 1}`);
      }
      if (
        o.birthWeightKg !== null &&
        (!(o.birthWeightKg > 0) || o.birthWeightKg > MAX_WEIGHT_KG)
      ) {
        throw new DomainError(
          `El peso al nacer de la cría ${i + 1} debe ser mayor a 0 kg`,
        );
      }
    });

    return new Birth({
      id: new UUID().getValue(),
      serviceId: service?.getId() ?? null,
      dam: toBreedingRef(dam),
      sire: sire ? toBreedingRef(sire) : null,
      species: dam.getSpecies(),
      birthDate,
      assistance: params.assistance,
      isHistorical: false,
      offspring: params.offspring.map((o, i) => ({
        id: new UUID().getValue(),
        position: i + 1,
        sex: o.sex,
        bornAlive: o.bornAlive,
        birthWeightKg: o.birthWeightKg,
        animal: null,
      })),
      notes: params.notes?.trim() || null,
      audit: newAuditInfo(params.createdBy),
    });
  }

  // ---------- Getters ----------

  public getId(): string {
    return this.props.id;
  }
  public getServiceId(): string | null {
    return this.props.serviceId;
  }
  public getDam(): BreedingAnimalRef {
    return this.props.dam;
  }
  public getSire(): BreedingAnimalRef | null {
    return this.props.sire;
  }
  public getSpecies(): Species {
    return this.props.species;
  }
  public getBirthDate(): string {
    return this.props.birthDate;
  }
  public getAssistance(): BirthAssistance | null {
    return this.props.assistance;
  }
  public getIsHistorical(): boolean {
    return this.props.isHistorical;
  }
  public getOffspring(): BirthOffspring[] {
    return [...this.props.offspring];
  }
  public getNotes(): string | null {
    return this.props.notes;
  }
  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  public getLitterSize(): number {
    return this.props.offspring.length;
  }
  public getLitterType(): LitterType {
    return LITTER_TYPES[this.props.offspring.length - 1];
  }
  public getBornAlive(): number {
    return this.props.offspring.filter((o) => o.bornAlive).length;
  }
  public getBornDead(): number {
    return this.props.offspring.filter((o) => !o.bornAlive).length;
  }

  // ---------- Edición ----------

  public linkOffspringAnimal(position: number, animal: Animal): void {
    const offspring = this.props.offspring.find((o) => o.position === position);
    if (!offspring?.bornAlive) {
      throw new DomainError(`La cría ${position} no nació viva`);
    }
    offspring.animal = {
      id: animal.getId(),
      earTag: animal.getEarTag(),
      name: animal.getName(),
    };
  }

  /** Las crías y los padres no se editan aquí: se corrigen en cada animal. */
  public update(changes: {
    assistance?: BirthAssistance | null;
    notes?: string | null;
  }): void {
    if (changes.assistance !== undefined) {
      this.props.assistance = changes.assistance;
    }
    if (changes.notes !== undefined) {
      this.props.notes = changes.notes?.trim() || null;
    }
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }

  /** Datos que conviene confirmar, pero no impiden registrar el parto. */
  public warnings(service: BreedingService | null): string[] {
    const warnings: string[] = [];
    if (this.getLitterSize() > 3) {
      warnings.push(
        `Parto de ${this.getLitterSize()} crías: es poco frecuente, verifique el dato.`,
      );
    }
    if (service) {
      const days = daysBetween(service.getServiceDate(), this.props.birthDate);
      if (days < BIRTH_WINDOW_DAYS.min || days > BIRTH_WINDOW_DAYS.max) {
        warnings.push(
          `El parto ocurrió ${days} días después de la monta del ${service.getServiceDate()} (lo habitual es entre ${BIRTH_WINDOW_DAYS.min} y ${BIRTH_WINDOW_DAYS.max}). Verifique la fecha o el padre.`,
        );
      }
      if (service.getStatus() === ServiceStatus.EMPTY) {
        warnings.push(
          'El último diagnóstico de la monta decía "vacía": revise ese diagnóstico.',
        );
      }
      const fetuses = service.getExpectedFetusCount();
      if (fetuses !== null && fetuses !== this.getLitterSize()) {
        warnings.push(
          `La ecografía indicaba ${fetuses} feto(s) y nacieron ${this.getLitterSize()} cría(s).`,
        );
      }
    } else if (!this.props.sire) {
      warnings.push(
        `Parto de ${describeAnimal(this.props.dam)} sin padre registrado: las crías quedan sin padre ni categoría esperada.`,
      );
    }
    this.props.offspring.forEach((o) => {
      if (o.birthWeightKg !== null && o.birthWeightKg > HIGH_BIRTH_WEIGHT_KG) {
        warnings.push(
          `Peso al nacer de la cría ${o.position} (${o.birthWeightKg} kg) inusualmente alto: verifique el dato.`,
        );
      }
    });
    return warnings;
  }
}
