import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { normalizeCatalogName } from './breed.model';

export interface AnimalColorProps {
  id: string;
  name: string;
  isActive: boolean;
  audit: AuditInfo;
}

/** Color de pelaje o lana. Catálogo común a ovinos y caprinos. */
export class AnimalColor {
  constructor(private readonly props: AnimalColorProps) {}

  static create(params: {
    name: string;
    createdBy: string | null;
  }): AnimalColor {
    const color = new AnimalColor({
      id: new UUID().getValue(),
      name: '',
      isActive: true,
      audit: newAuditInfo(params.createdBy),
    });
    color.rename(params.name);
    return color;
  }

  public getId(): string {
    return this.props.id;
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
    this.props.name = normalizeCatalogName(name, 'El nombre del color');
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
