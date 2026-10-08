import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';

export interface AreaProps {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  audit: AuditInfo;
}

export class Area {
  constructor(private readonly props: AreaProps) {}

  static create(params: {
    name: string;
    description?: string;
    createdBy: string | null;
  }): Area {
    const area = new Area({
      id: new UUID().getValue(),
      name: '',
      description: params.description ?? '',
      isActive: true,
      audit: newAuditInfo(params.createdBy),
    });
    area.rename(params.name);
    return area;
  }

  public getId(): string {
    return this.props.id;
  }

  public getName(): string {
    return this.props.name;
  }

  public getDescription(): string {
    return this.props.description;
  }

  public getIsActive(): boolean {
    return this.props.isActive;
  }

  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  public rename(name: string): void {
    if (!name || name.trim() === '') {
      throw new DomainError('El nombre del área no puede estar vacío');
    }
    this.props.name = name.trim();
  }

  public updateDescription(description: string): void {
    this.props.description = description;
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
