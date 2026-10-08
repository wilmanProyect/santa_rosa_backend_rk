import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { Area } from '@modules/areas/domain/models/area.model';
import { Permission } from './permission.model';

export interface RoleProps {
  id: string;
  name: string;
  description: string;
  area: Area | null;
  isActive: boolean;
  /** Rol del sistema (Administrador): no se puede renombrar, desactivar, eliminar ni quitarle permisos. */
  isSystem: boolean;
  permissions: Permission[];
  audit: AuditInfo;
}

export class Role {
  constructor(private readonly props: RoleProps) {}

  static create(params: {
    name: string;
    description?: string;
    area: Area | null;
    permissions: Permission[];
    createdBy: string | null;
    isSystem?: boolean;
  }): Role {
    const role = new Role({
      id: new UUID().getValue(),
      name: '',
      description: params.description ?? '',
      area: params.area,
      isActive: true,
      isSystem: params.isSystem ?? false,
      permissions: params.permissions,
      audit: newAuditInfo(params.createdBy),
    });
    role.setName(params.name);
    return role;
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

  public getArea(): Area | null {
    return this.props.area;
  }

  public getIsActive(): boolean {
    return this.props.isActive;
  }

  public getIsSystem(): boolean {
    return this.props.isSystem;
  }

  public getPermissions(): Permission[] {
    return this.props.permissions;
  }

  public getPermissionCodes(): string[] {
    return this.props.permissions.map((p) => p.getCode());
  }

  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  public rename(name: string): void {
    this.assertNotSystem('renombrar');
    this.setName(name);
  }

  public updateDescription(description: string): void {
    this.props.description = description;
  }

  public assignArea(area: Area | null): void {
    this.props.area = area;
  }

  public updatePermissions(permissions: Permission[]): void {
    this.assertNotSystem('modificar los permisos de');
    this.props.permissions = permissions;
  }

  /** Solo para el seeder: mantiene el rol del sistema con el catálogo completo. */
  public syncSystemPermissions(permissions: Permission[]): void {
    if (!this.props.isSystem) {
      throw new DomainError(
        'Solo el rol del sistema se sincroniza automáticamente',
      );
    }
    this.props.permissions = permissions;
  }

  public activate(): void {
    this.props.isActive = true;
  }

  public deactivate(): void {
    this.assertNotSystem('desactivar');
    this.props.isActive = false;
  }

  public ensureDeletable(): void {
    this.assertNotSystem('eliminar');
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }

  private setName(name: string): void {
    if (!name || name.trim() === '') {
      throw new DomainError('El nombre del rol no puede estar vacío');
    }
    this.props.name = name.trim();
  }

  private assertNotSystem(action: string): void {
    if (this.props.isSystem) {
      throw new DomainError(
        `No se puede ${action} el rol del sistema "${this.props.name}"`,
      );
    }
  }
}
