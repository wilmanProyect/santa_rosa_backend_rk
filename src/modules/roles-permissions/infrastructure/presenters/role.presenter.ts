import { AreaPresenter } from '@modules/areas/infrastructure/presenters/area.presenter';
import { Role } from '../../domain/models/role.model';
import { Permission } from '../../domain/models/permission.model';

export class RolePresenter {
  static permission(permission: Permission) {
    return {
      id: permission.getId(),
      code: permission.getCode(),
      module: permission.getModule(),
      description: permission.getDescription(),
    };
  }

  static toSummary(role: Role) {
    return {
      id: role.getId(),
      name: role.getName(),
      isActive: role.getIsActive(),
      isSystem: role.getIsSystem(),
    };
  }

  static toResponse(role: Role) {
    const audit = role.getAudit();
    return {
      id: role.getId(),
      name: role.getName(),
      description: role.getDescription(),
      area: AreaPresenter.toSummary(role.getArea()),
      isActive: role.getIsActive(),
      isSystem: role.getIsSystem(),
      permissions: role.getPermissions().map((p) => this.permission(p)),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
