import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { Role } from '@modules/roles-permissions/domain/models/role.model';
import { Area } from '@modules/areas/domain/models/area.model';
import { Email } from '../value-objects/email.vo';
import { Password } from '../value-objects/password.vo';
import { Username } from '../value-objects/username.vo';
import { InactiveReason, UserStatus } from '../enums/user-status.enum';
import { PermissionEffect } from '../enums/permission-effect.enum';
import { PermissionOverride } from './permission-override';

export interface PersonalData {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  ciNumber: string | null;
  email: Email | null;
  /** Fecha sin hora, formato YYYY-MM-DD. */
  birthDate: string | null;
  phone: string | null;
  position: string | null;
}

export interface LoginLockPolicy {
  maxFailedAttempts: number;
  lockMinutes: number;
}

export interface UserProps extends PersonalData {
  id: string;
  username: Username;
  password: Password;
  area: Area | null;

  status: UserStatus;
  inactiveReason: InactiveReason | null;
  /** Fecha de baja, formato YYYY-MM-DD. */
  inactiveDate: string | null;
  inactiveNotes: string | null;

  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;

  roles: Role[];
  permissionOverrides: PermissionOverride[];
  audit: AuditInfo;
}

export class User {
  constructor(private readonly props: UserProps) {}

  static create(
    params: PersonalData & {
      username: Username;
      password: Password;
      area: Area | null;
      roles: Role[];
      createdBy: string | null;
      mustChangePassword?: boolean;
      now: Date;
    },
  ): User {
    const user = new User({
      id: new UUID().getValue(),
      firstName: '',
      paternalLastName: '',
      maternalLastName: null,
      ciNumber: null,
      email: null,
      birthDate: null,
      phone: null,
      position: null,
      username: params.username,
      password: params.password,
      area: params.area,
      status: UserStatus.ACTIVE,
      inactiveReason: null,
      inactiveDate: null,
      inactiveNotes: null,
      mustChangePassword: params.mustChangePassword ?? true,
      passwordChangedAt: params.now,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      roles: params.roles,
      permissionOverrides: [],
      audit: newAuditInfo(params.createdBy),
    });
    user.updatePersonalData(params, params.now);
    return user;
  }

  // ---------- Getters ----------

  public getId(): string {
    return this.props.id;
  }

  public getFirstName(): string {
    return this.props.firstName;
  }

  public getPaternalLastName(): string {
    return this.props.paternalLastName;
  }

  public getMaternalLastName(): string | null {
    return this.props.maternalLastName;
  }

  public getFullName(): string {
    return [
      this.props.firstName,
      this.props.paternalLastName,
      this.props.maternalLastName,
    ]
      .filter(Boolean)
      .join(' ');
  }

  public getCiNumber(): string | null {
    return this.props.ciNumber;
  }

  public getUsername(): Username {
    return this.props.username;
  }

  public getEmail(): Email | null {
    return this.props.email;
  }

  public getPassword(): Password {
    return this.props.password;
  }

  public getBirthDate(): string | null {
    return this.props.birthDate;
  }

  public getPhone(): string | null {
    return this.props.phone;
  }

  public getPosition(): string | null {
    return this.props.position;
  }

  public getArea(): Area | null {
    return this.props.area;
  }

  public getStatus(): UserStatus {
    return this.props.status;
  }

  public isActive(): boolean {
    return this.props.status === UserStatus.ACTIVE;
  }

  public getInactiveReason(): InactiveReason | null {
    return this.props.inactiveReason;
  }

  public getInactiveDate(): string | null {
    return this.props.inactiveDate;
  }

  public getInactiveNotes(): string | null {
    return this.props.inactiveNotes;
  }

  public getMustChangePassword(): boolean {
    return this.props.mustChangePassword;
  }

  public getPasswordChangedAt(): Date | null {
    return this.props.passwordChangedAt;
  }

  public getFailedLoginAttempts(): number {
    return this.props.failedLoginAttempts;
  }

  public getLockedUntil(): Date | null {
    return this.props.lockedUntil;
  }

  public getLastLoginAt(): Date | null {
    return this.props.lastLoginAt;
  }

  public getRoles(): Role[] {
    return this.props.roles;
  }

  public getPermissionOverrides(): PermissionOverride[] {
    return this.props.permissionOverrides;
  }

  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  // ---------- Datos personales ----------

  public updatePersonalData(data: Partial<PersonalData>, now: Date): void {
    if (data.firstName !== undefined) {
      this.props.firstName = requireText(data.firstName, 'El nombre');
    }
    if (data.paternalLastName !== undefined) {
      this.props.paternalLastName = requireText(
        data.paternalLastName,
        'El apellido paterno',
      );
    }
    if (data.maternalLastName !== undefined) {
      this.props.maternalLastName = optionalText(data.maternalLastName);
    }
    if (data.ciNumber !== undefined) {
      this.props.ciNumber = optionalText(data.ciNumber)?.toUpperCase() ?? null;
    }
    if (data.email !== undefined) {
      this.props.email = data.email;
    }
    if (data.birthDate !== undefined) {
      if (data.birthDate !== null && data.birthDate > toDateOnly(now)) {
        throw new DomainError('La fecha de nacimiento no puede ser futura');
      }
      this.props.birthDate = data.birthDate;
    }
    if (data.phone !== undefined) {
      this.props.phone = optionalText(data.phone);
    }
    if (data.position !== undefined) {
      this.props.position = optionalText(data.position);
    }
  }

  public changeUsername(username: Username): void {
    this.props.username = username;
  }

  public assignArea(area: Area | null): void {
    this.props.area = area;
  }

  // ---------- Estado (alta / baja) ----------

  public deactivate(params: {
    reason: InactiveReason;
    date: string;
    notes: string | null;
  }): void {
    this.props.status = UserStatus.INACTIVE;
    this.props.inactiveReason = params.reason;
    this.props.inactiveDate = params.date;
    this.props.inactiveNotes = optionalText(params.notes);
  }

  public activate(): void {
    this.props.status = UserStatus.ACTIVE;
    this.props.inactiveReason = null;
    this.props.inactiveDate = null;
    this.props.inactiveNotes = null;
  }

  // ---------- Roles y permisos ----------

  public assignRoles(roles: Role[]): void {
    this.props.roles = roles;
  }

  public hasSystemRole(): boolean {
    return this.props.roles.some((r) => r.getIsSystem());
  }

  public setPermissionOverrides(overrides: PermissionOverride[]): void {
    const seen = new Set<string>();
    for (const override of overrides) {
      const id = override.permission.getId();
      if (seen.has(id)) {
        throw new DomainError(
          `El permiso "${override.permission.getCode()}" no puede otorgarse y denegarse a la vez`,
        );
      }
      seen.add(id);
    }
    this.props.permissionOverrides = overrides;
  }

  /**
   * Permisos efectivos = permisos de los roles activos + permisos otorgados
   * individualmente − permisos denegados individualmente (la denegación gana).
   */
  public getEffectivePermissionCodes(): string[] {
    const codes = new Set<string>();
    for (const role of this.props.roles) {
      if (!role.getIsActive()) continue;
      role.getPermissionCodes().forEach((code) => codes.add(code));
    }
    for (const override of this.props.permissionOverrides) {
      if (override.effect === PermissionEffect.GRANT) {
        codes.add(override.permission.getCode());
      }
    }
    for (const override of this.props.permissionOverrides) {
      if (override.effect === PermissionEffect.DENY) {
        codes.delete(override.permission.getCode());
      }
    }
    return [...codes].sort();
  }

  // ---------- Contraseña ----------

  /** Cambio hecho por el propio usuario. */
  public changePassword(password: Password, now: Date): void {
    this.props.password = password;
    this.props.passwordChangedAt = now;
    this.props.mustChangePassword = false;
  }

  /** Restablecimiento hecho por un administrador: obliga a cambiarla y desbloquea la cuenta. */
  public resetPassword(password: Password, now: Date): void {
    this.props.password = password;
    this.props.passwordChangedAt = now;
    this.props.mustChangePassword = true;
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
  }

  /**
   * Una sesión es válida solo si se creó después del último cambio de contraseña.
   * Así, cambiar o restablecer la contraseña cierra todas las sesiones anteriores.
   */
  public isSessionStillValid(sessionCreatedAt: Date): boolean {
    const changedAt = this.props.passwordChangedAt;
    return !changedAt || sessionCreatedAt.getTime() >= changedAt.getTime();
  }

  // ---------- Login / bloqueo ----------

  public isLocked(now: Date): boolean {
    return (
      !!this.props.lockedUntil &&
      this.props.lockedUntil.getTime() > now.getTime()
    );
  }

  /** Registra un intento fallido y bloquea la cuenta al alcanzar el máximo. */
  public registerFailedLogin(policy: LoginLockPolicy, now: Date): void {
    this.props.failedLoginAttempts += 1;
    if (this.props.failedLoginAttempts >= policy.maxFailedAttempts) {
      this.props.lockedUntil = new Date(
        now.getTime() + policy.lockMinutes * 60_000,
      );
      this.props.failedLoginAttempts = 0;
    }
  }

  public registerSuccessfulLogin(now: Date): void {
    this.props.failedLoginAttempts = 0;
    this.props.lockedUntil = null;
    this.props.lastLoginAt = now;
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }
}

function requireText(value: string, field: string): string {
  if (!value || value.trim() === '') {
    throw new DomainError(`${field} no puede estar vacío`);
  }
  return value.trim();
}

function optionalText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
