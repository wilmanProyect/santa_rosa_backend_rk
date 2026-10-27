import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { StoredFile } from '@shared/domain/stored-file';
import { toDateOnly } from '@shared/domain/date-only';
import {
  AnimalStatus,
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '../enums/animal.enums';
import { Breed } from './breed.model';
import { AnimalColor } from './animal-color.model';
import { AnimalParent } from './animal-parent';

/** Datos del animal que se pueden editar libremente (sujetos a las reglas del dominio). */
export interface AnimalData {
  earTag: string | null;
  name: string | null;
  species: Species;
  breed: Breed;
  sex: Sex;
  color: AnimalColor | null;
  geneticCategory: GeneticCategory | null;

  absidRegistry: string | null;
  absidCertificateCode: string | null;
  /** Registro en otra entidad o código del reproductor en el centro de semen. */
  externalRegistry: string | null;

  /**
   * Caso especial: el animal se registró en la cabaña con un arete o un
   * registro ABSID que ya tiene otro animal, y por política no se corrige.
   * Permite el duplicado y exige dejar el motivo.
   */
  identifierException: boolean;
  identifierExceptionReason: string | null;

  dam: AnimalParent | null;
  sire: AnimalParent | null;

  /** Fechas sin hora, formato YYYY-MM-DD. */
  birthDate: string | null;
  birthWeightKg: number | null;
  weaningDate: string | null;
  weaningWeightKg: number | null;

  entryOrigin: EntryOrigin | null;
  entryDate: string | null;
  /** Cabaña de procedencia (o centro de semen, en animales externos). */
  sourceFarm: string | null;

  notes: string | null;
}

export interface AnimalProps extends AnimalData {
  id: string;
  /**
   * Animal que no pertenece a la cabaña (p. ej. un donante de semen o un
   * reproductor ajeno). Se registra solo para la genealogía: no forma parte
   * del inventario y no tiene datos de ingreso ni cambios de estado.
   */
  isExternal: boolean;

  status: AnimalStatus;
  statusDate: string | null;
  /** Detalle del estado (causa de muerte, comprador, etc.). */
  statusReason: string | null;

  certificateFile: StoredFile | null;
  audit: AuditInfo;
}

export type AnimalChanges = Partial<AnimalData>;

const PARENT_LABELS = {
  dam: {
    name: 'La madre',
    sex: Sex.FEMALE,
    sexName: 'hembra',
    self: 'su propia madre',
  },
  sire: {
    name: 'El padre',
    sex: Sex.MALE,
    sexName: 'macho',
    self: 'su propio padre',
  },
} as const;

export class Animal {
  constructor(private readonly props: AnimalProps) {}

  static create(
    params: Partial<AnimalData> &
      Pick<AnimalData, 'species' | 'breed' | 'sex'> & {
        isExternal: boolean;
        createdBy: string | null;
        now: Date;
      },
  ): Animal {
    const { isExternal, createdBy, now, ...data } = params;
    const animal = new Animal({
      id: new UUID().getValue(),
      isExternal,
      earTag: null,
      name: null,
      species: data.species,
      breed: data.breed,
      sex: data.sex,
      color: null,
      geneticCategory: null,
      absidRegistry: null,
      absidCertificateCode: null,
      externalRegistry: null,
      identifierException: false,
      identifierExceptionReason: null,
      dam: null,
      sire: null,
      birthDate: null,
      birthWeightKg: null,
      weaningDate: null,
      weaningWeightKg: null,
      entryOrigin: isExternal ? null : EntryOrigin.BORN_ON_FARM,
      entryDate: null,
      sourceFarm: null,
      notes: null,
      status: AnimalStatus.ALIVE,
      statusDate: null,
      statusReason: null,
      certificateFile: null,
      audit: newAuditInfo(createdBy),
    });
    animal.update(data, now);
    return animal;
  }

  // ---------- Getters ----------

  public getId(): string {
    return this.props.id;
  }

  public getIsExternal(): boolean {
    return this.props.isExternal;
  }

  public getEarTag(): string | null {
    return this.props.earTag;
  }

  public getName(): string | null {
    return this.props.name;
  }

  public getSpecies(): Species {
    return this.props.species;
  }

  public getBreed(): Breed {
    return this.props.breed;
  }

  public getSex(): Sex {
    return this.props.sex;
  }

  public getColor(): AnimalColor | null {
    return this.props.color;
  }

  public getGeneticCategory(): GeneticCategory | null {
    return this.props.geneticCategory;
  }

  public getAbsidRegistry(): string | null {
    return this.props.absidRegistry;
  }

  public getAbsidCertificateCode(): string | null {
    return this.props.absidCertificateCode;
  }

  public getExternalRegistry(): string | null {
    return this.props.externalRegistry;
  }

  public getIdentifierException(): boolean {
    return this.props.identifierException;
  }

  public getIdentifierExceptionReason(): string | null {
    return this.props.identifierExceptionReason;
  }

  public getCertificateFile(): StoredFile | null {
    return this.props.certificateFile;
  }

  public getDam(): AnimalParent | null {
    return this.props.dam;
  }

  public getSire(): AnimalParent | null {
    return this.props.sire;
  }

  public getBirthDate(): string | null {
    return this.props.birthDate;
  }

  public getBirthWeightKg(): number | null {
    return this.props.birthWeightKg;
  }

  public getWeaningDate(): string | null {
    return this.props.weaningDate;
  }

  public getWeaningWeightKg(): number | null {
    return this.props.weaningWeightKg;
  }

  public getEntryOrigin(): EntryOrigin | null {
    return this.props.entryOrigin;
  }

  public getEntryDate(): string | null {
    return this.props.entryDate;
  }

  public getSourceFarm(): string | null {
    return this.props.sourceFarm;
  }

  public getStatus(): AnimalStatus {
    return this.props.status;
  }

  public getStatusDate(): string | null {
    return this.props.statusDate;
  }

  public getStatusReason(): string | null {
    return this.props.statusReason;
  }

  public getNotes(): string | null {
    return this.props.notes;
  }

  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  /** Forma parte del inventario actual de la cabaña. */
  public isInInventory(): boolean {
    return !this.props.isExternal && this.props.status === AnimalStatus.ALIVE;
  }

  public toParent(): AnimalParent {
    return {
      id: this.props.id,
      earTag: this.props.earTag,
      name: this.props.name,
      species: this.props.species,
      sex: this.props.sex,
      birthDate: this.props.birthDate,
      isExternal: this.props.isExternal,
    };
  }

  // ---------- Edición ----------

  /** Aplica solo los campos definidos y valida el resultado completo. */
  public update(changes: AnimalChanges, now: Date): void {
    const p = this.props;
    if (changes.earTag !== undefined) p.earTag = normalizeCode(changes.earTag);
    if (changes.name !== undefined) p.name = optionalText(changes.name);
    if (changes.species !== undefined) p.species = changes.species;
    if (changes.breed !== undefined) p.breed = changes.breed;
    if (changes.sex !== undefined) p.sex = changes.sex;
    if (changes.color !== undefined) p.color = changes.color;
    if (changes.geneticCategory !== undefined) {
      p.geneticCategory = changes.geneticCategory;
    }
    if (changes.absidRegistry !== undefined) {
      p.absidRegistry = normalizeCode(changes.absidRegistry);
    }
    if (changes.absidCertificateCode !== undefined) {
      p.absidCertificateCode = normalizeCode(changes.absidCertificateCode);
    }
    if (changes.externalRegistry !== undefined) {
      p.externalRegistry = normalizeCode(changes.externalRegistry);
    }
    if (changes.identifierException !== undefined) {
      p.identifierException = changes.identifierException;
    }
    if (changes.identifierExceptionReason !== undefined) {
      p.identifierExceptionReason = optionalText(
        changes.identifierExceptionReason,
      );
    }
    // Al quitar el caso especial, el motivo deja de tener sentido.
    if (!p.identifierException) p.identifierExceptionReason = null;
    if (changes.dam !== undefined) p.dam = changes.dam;
    if (changes.sire !== undefined) p.sire = changes.sire;
    if (changes.birthDate !== undefined) p.birthDate = changes.birthDate;
    if (changes.birthWeightKg !== undefined) {
      p.birthWeightKg = changes.birthWeightKg;
    }
    if (changes.weaningDate !== undefined) p.weaningDate = changes.weaningDate;
    if (changes.weaningWeightKg !== undefined) {
      p.weaningWeightKg = changes.weaningWeightKg;
    }
    if (changes.entryOrigin !== undefined) p.entryOrigin = changes.entryOrigin;
    if (changes.entryDate !== undefined) p.entryDate = changes.entryDate;
    if (changes.sourceFarm !== undefined) {
      p.sourceFarm = optionalText(changes.sourceFarm);
    }
    if (changes.notes !== undefined) p.notes = optionalText(changes.notes);

    this.assertInvariants(now);
  }

  // ---------- Estado ----------

  /**
   * Registra la salida del animal (muerte, venta, faena, regalo) o lo vuelve a
   * ALIVE para corregir un error, lo que borra la fecha y el detalle.
   */
  public changeStatus(
    params: {
      status: AnimalStatus;
      date: string | null;
      reason: string | null;
    },
    now: Date,
  ): void {
    if (this.props.isExternal) {
      throw new DomainError(
        'Los animales externos no forman parte del inventario: no tienen estado',
      );
    }
    if (params.status === AnimalStatus.ALIVE) {
      this.props.statusDate = null;
      this.props.statusReason = null;
    } else {
      if (!params.date) {
        throw new DomainError('Indique la fecha del cambio de estado');
      }
      this.props.statusDate = params.date;
      this.props.statusReason = optionalText(params.reason);
    }
    this.props.status = params.status;
    this.assertInvariants(now);
  }

  // ---------- Certificado ABSID ----------

  /** Devuelve el archivo anterior, para que se elimine del almacenamiento. */
  public attachCertificateFile(file: StoredFile): StoredFile | null {
    const previous = this.props.certificateFile;
    this.props.certificateFile = file;
    return previous;
  }

  public removeCertificateFile(): StoredFile | null {
    const previous = this.props.certificateFile;
    this.props.certificateFile = null;
    return previous;
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }

  // ---------- Reglas ----------

  /**
   * Reglas que debe cumplir siempre el animal. Las que no dependen de otras
   * filas también están como CHECK en la base de datos.
   */
  private assertInvariants(now: Date): void {
    const p = this.props;
    const today = toDateOnly(now);

    if (p.breed.getSpecies() !== p.species) {
      throw new DomainError(
        `La raza "${p.breed.getName()}" no corresponde a la especie del animal`,
      );
    }

    if (p.isExternal) {
      if (!p.earTag && !p.name && !p.absidRegistry && !p.externalRegistry) {
        throw new DomainError(
          'Un animal externo debe tener al menos arete, nombre, registro ABSID o registro externo',
        );
      }
      if (p.entryOrigin !== null || p.entryDate !== null) {
        throw new DomainError(
          'Un animal externo no tiene origen ni fecha de ingreso a la cabaña',
        );
      }
    } else {
      if (!p.earTag) {
        throw new DomainError('El arete es obligatorio');
      }
      if (!p.geneticCategory) {
        throw new DomainError('La categoría genética es obligatoria');
      }
      if (!p.entryOrigin) {
        throw new DomainError('El origen de ingreso es obligatorio');
      }
      if (p.entryOrigin === EntryOrigin.BORN_ON_FARM) {
        if (!p.birthDate) {
          throw new DomainError(
            'La fecha de nacimiento es obligatoria para los animales nacidos en la cabaña',
          );
        }
        if (p.entryDate || p.sourceFarm) {
          throw new DomainError(
            'Un animal nacido en la cabaña no tiene fecha de ingreso ni cabaña de procedencia',
          );
        }
      } else if (!p.entryDate) {
        throw new DomainError(
          'La fecha de ingreso es obligatoria si el animal no nació en la cabaña',
        );
      }
    }

    assertNotFuture(p.birthDate, 'La fecha de nacimiento', today);
    assertNotFuture(p.weaningDate, 'La fecha de destete', today);
    assertNotFuture(p.entryDate, 'La fecha de ingreso', today);
    assertNotFuture(p.statusDate, 'La fecha del estado', today);

    assertNotBefore(
      p.weaningDate,
      p.birthDate,
      'La fecha de destete',
      'nacimiento',
    );
    assertNotBefore(
      p.entryDate,
      p.birthDate,
      'La fecha de ingreso',
      'nacimiento',
    );
    assertNotBefore(
      p.statusDate,
      p.birthDate,
      'La fecha del estado',
      'nacimiento',
    );
    assertNotBefore(
      p.statusDate,
      p.entryDate,
      'La fecha del estado',
      'ingreso',
    );

    assertPositive(p.birthWeightKg, 'El peso al nacer');
    assertPositive(p.weaningWeightKg, 'El peso al destete');
    if (p.weaningWeightKg !== null && !p.weaningDate) {
      throw new DomainError('Indique la fecha de destete junto con el peso');
    }

    if (p.identifierException && !p.identifierExceptionReason) {
      throw new DomainError(
        'Indique el motivo del caso especial (arete o registro ABSID repetido)',
      );
    }

    this.assertParent(p.dam, PARENT_LABELS.dam);
    this.assertParent(p.sire, PARENT_LABELS.sire);
  }

  private assertParent(
    parent: AnimalParent | null,
    label: (typeof PARENT_LABELS)[keyof typeof PARENT_LABELS],
  ): void {
    if (!parent) return;
    if (parent.id === this.props.id) {
      throw new DomainError(`El animal no puede ser ${label.self}`);
    }
    if (parent.sex !== label.sex) {
      throw new DomainError(`${label.name} debe ser ${label.sexName}`);
    }
    if (parent.species !== this.props.species) {
      throw new DomainError(`${label.name} debe ser de la misma especie`);
    }
    if (
      parent.birthDate &&
      this.props.birthDate &&
      parent.birthDate >= this.props.birthDate
    ) {
      throw new DomainError(
        `${label.name} debe haber nacido antes que la cría`,
      );
    }
  }
}

function optionalText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Aretes y registros: sin espacios alrededor y en mayúsculas, para comparar sin ambigüedad. */
function normalizeCode(value: string | null): string | null {
  return optionalText(value)?.toUpperCase() ?? null;
}

function assertNotFuture(date: string | null, field: string, today: string) {
  if (date && date > today) {
    throw new DomainError(`${field} no puede ser futura`);
  }
}

function assertNotBefore(
  date: string | null,
  reference: string | null,
  field: string,
  referenceName: string,
) {
  if (date && reference && date < reference) {
    throw new DomainError(
      `${field} no puede ser anterior a la fecha de ${referenceName}`,
    );
  }
}

function assertPositive(value: number | null, field: string) {
  if (value !== null && !(value > 0)) {
    throw new DomainError(`${field} debe ser mayor a cero`);
  }
}
