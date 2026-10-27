import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { Species } from '../enums/animal.enums';

export interface BreedProps {
  id: string;
  species: Species;
  name: string;
  isActive: boolean;
  audit: AuditInfo;
}

/** Raza. Cada raza pertenece a una sola especie. */
export class Breed {
  constructor(private readonly props: BreedProps) {}

  static create(params: {
    species: Species;
    name: string;
    createdBy: string | null;
  }): Breed {
    const breed = new Breed({
      id: new UUID().getValue(),
      species: params.species,
      name: '',
      isActive: true,
      audit: newAuditInfo(params.createdBy),
    });
    breed.rename(params.name);
    return breed;
  }

  public getId(): string {
    return this.props.id;
  }

  public getSpecies(): Species {
    return this.props.species;
  }

  public getName(): string {
    return this.props.name;
  }

  public getIsActive(): boolean {
    return this.props.isActive;
  }

  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  public rename(name: string): void {
    this.props.name = normalizeCatalogName(name, 'El nombre de la raza');
  }

  public changeSpecies(species: Species): void {
    this.props.species = species;
  }

  public activate(): void {
    this.props.isActive = true;
  }

  public deactivate(): void {
    this.props.isActive = false;
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }
}

/** Recorta y colapsa espacios internos: "  Anglo   Nubian " → "Anglo Nubian". */
export function normalizeCatalogName(value: string, field: string): string {
  const name = (value ?? '').trim().replace(/\s+/g, ' ');
  if (name === '') {
    throw new DomainError(`${field} no puede estar vacío`);
  }
  return name;
}
