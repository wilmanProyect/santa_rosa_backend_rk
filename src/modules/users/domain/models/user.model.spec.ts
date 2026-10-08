import { DomainError } from '@shared/domain/errors/domain.error';
import { Role } from '@modules/roles-permissions/domain/models/role.model';
import { Permission } from '@modules/roles-permissions/domain/models/permission.model';
import { User } from './user.model';
import { Username } from '../value-objects/username.vo';
import { Password } from '../value-objects/password.vo';
import { PermissionEffect } from '../enums/permission-effect.enum';

const NOW = new Date('2026-10-07T12:00:00Z');

const permission = (code: string) =>
  new Permission(`id-${code}`, code, 'Test', code);

const role = (name: string, codes: string[]) =>
  Role.create({
    name,
    area: null,
    permissions: codes.map(permission),
    createdBy: null,
  });

const buildUser = (roles: Role[] = []) =>
  User.create({
    firstName: 'Juan',
    paternalLastName: 'Pérez',
    maternalLastName: null,
    ciNumber: '1234567',
    email: null,
    birthDate: '1990-01-01',
    phone: null,
    position: null,
    username: new Username('jperez'),
    password: new Password('hash'),
    area: null,
    roles,
    createdBy: null,
    now: NOW,
  });

describe('User', () => {
  describe('getEffectivePermissionCodes', () => {
    it('combina los permisos de todos los roles activos', () => {
      const user = buildUser([
        role('Contador', ['users:read', 'roles:read']),
        role('Supervisor', ['users:read', 'users:update']),
      ]);

      expect(user.getEffectivePermissionCodes()).toEqual([
        'roles:read',
        'users:read',
        'users:update',
      ]);
    });

    it('ignora los roles inactivos', () => {
      const inactive = role('Inactivo', ['users:delete']);
      inactive.deactivate();
      const user = buildUser([role('Lector', ['users:read']), inactive]);

      expect(user.getEffectivePermissionCodes()).toEqual(['users:read']);
    });

    it('suma los permisos otorgados y la denegación gana sobre el rol', () => {
      const user = buildUser([role('Lector', ['users:read', 'users:update'])]);
      user.setPermissionOverrides([
        {
          permission: permission('audit:read'),
          effect: PermissionEffect.GRANT,
        },
        {
          permission: permission('users:update'),
          effect: PermissionEffect.DENY,
        },
      ]);

      expect(user.getEffectivePermissionCodes()).toEqual([
        'audit:read',
        'users:read',
      ]);
    });

    it('rechaza otorgar y denegar el mismo permiso', () => {
      const user = buildUser();
      expect(() =>
        user.setPermissionOverrides([
          {
            permission: permission('users:read'),
            effect: PermissionEffect.GRANT,
          },
          {
            permission: permission('users:read'),
            effect: PermissionEffect.DENY,
          },
        ]),
      ).toThrow(DomainError);
    });
  });

  describe('bloqueo por intentos fallidos', () => {
    const policy = { maxFailedAttempts: 3, lockMinutes: 15 };

    it('bloquea la cuenta al llegar al máximo de intentos', () => {
      const user = buildUser();
      user.registerFailedLogin(policy, NOW);
      user.registerFailedLogin(policy, NOW);
      expect(user.isLocked(NOW)).toBe(false);

      user.registerFailedLogin(policy, NOW);
      expect(user.isLocked(NOW)).toBe(true);
      expect(user.isLocked(new Date(NOW.getTime() + 16 * 60_000))).toBe(false);
    });

    it('un login exitoso reinicia el contador', () => {
      const user = buildUser();
      user.registerFailedLogin(policy, NOW);
      user.registerFailedLogin(policy, NOW);
      user.registerSuccessfulLogin(NOW);
      user.registerFailedLogin(policy, NOW);

      expect(user.isLocked(NOW)).toBe(false);
      expect(user.getLastLoginAt()).toBe(NOW);
    });
  });

  describe('contraseña y sesiones', () => {
    it('un usuario nuevo debe cambiar la contraseña', () => {
      expect(buildUser().getMustChangePassword()).toBe(true);
    });

    it('cambiar la contraseña invalida las sesiones anteriores', () => {
      const user = buildUser();
      const oldSession = new Date(NOW.getTime() + 1_000);
      const changedAt = new Date(NOW.getTime() + 2_000);

      user.changePassword(new Password('new-hash'), changedAt);

      expect(user.getMustChangePassword()).toBe(false);
      expect(user.isSessionStillValid(oldSession)).toBe(false);
      expect(user.isSessionStillValid(changedAt)).toBe(true);
    });

    it('el restablecimiento por un admin obliga a cambiarla y desbloquea', () => {
      const user = buildUser();
      for (let i = 0; i < 5; i++) {
        user.registerFailedLogin(
          { maxFailedAttempts: 5, lockMinutes: 15 },
          NOW,
        );
      }
      expect(user.isLocked(NOW)).toBe(true);

      user.resetPassword(new Password('temp-hash'), NOW);

      expect(user.isLocked(NOW)).toBe(false);
      expect(user.getMustChangePassword()).toBe(true);
    });
  });

  it('rechaza una fecha de nacimiento futura', () => {
    const user = buildUser();
    expect(() =>
      user.updatePersonalData({ birthDate: '2030-01-01' }, NOW),
    ).toThrow(DomainError);
  });
});
