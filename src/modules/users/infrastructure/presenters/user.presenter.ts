import { AreaPresenter } from '@modules/areas/infrastructure/presenters/area.presenter';
import { RolePresenter } from '@modules/roles-permissions/infrastructure/presenters/role.presenter';
import { User } from '../../domain/models/user.model';

export class UserPresenter {
  /** Versión resumida para listados. */
  static toSummary(user: User) {
    return {
      id: user.getId(),
      firstName: user.getFirstName(),
      paternalLastName: user.getPaternalLastName(),
      maternalLastName: user.getMaternalLastName(),
      fullName: user.getFullName(),
      username: user.getUsername().getValue(),
      email: user.getEmail()?.getValue() ?? null,
      ciNumber: user.getCiNumber(),
      position: user.getPosition(),
      area: AreaPresenter.toSummary(user.getArea()),
      status: user.getStatus(),
      inactiveReason: user.getInactiveReason(),
      lastLoginAt: user.getLastLoginAt(),
      roles: user.getRoles().map((r) => RolePresenter.toSummary(r)),
    };
  }

  /** Versión completa, con permisos y datos de auditoría. */
  static toResponse(user: User) {
    const audit = user.getAudit();
    return {
      ...this.toSummary(user),
      birthDate: user.getBirthDate(),
      phone: user.getPhone(),
      inactiveDate: user.getInactiveDate(),
      inactiveNotes: user.getInactiveNotes(),
      mustChangePassword: user.getMustChangePassword(),
      passwordChangedAt: user.getPasswordChangedAt(),
      lockedUntil: user.getLockedUntil(),
      permissionOverrides: user.getPermissionOverrides().map((o) => ({
        effect: o.effect,
        permission: RolePresenter.permission(o.permission),
      })),
      effectivePermissions: user.getEffectivePermissionCodes(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
