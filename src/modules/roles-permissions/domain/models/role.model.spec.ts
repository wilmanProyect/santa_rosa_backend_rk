import { DomainError } from '@shared/domain/errors/domain.error';
import { Role } from './role.model';

describe('Role', () => {
  const systemRole = () =>
    Role.create({
      name: 'Administrador',
      area: null,
      permissions: [],
      createdBy: null,
      isSystem: true,
    });

  it('el rol del sistema no se puede renombrar, desactivar, eliminar ni editar permisos', () => {
    const role = systemRole();
    expect(() => role.rename('Otro')).toThrow(DomainError);
    expect(() => role.deactivate()).toThrow(DomainError);
    expect(() => role.ensureDeletable()).toThrow(DomainError);
    expect(() => role.updatePermissions([])).toThrow(DomainError);
  });

  it('un rol normal sí se puede modificar', () => {
    const role = Role.create({
      name: 'Contador',
      area: null,
      permissions: [],
      createdBy: null,
    });
    role.rename('Contador Senior');
    role.deactivate();
    expect(role.getName()).toBe('Contador Senior');
    expect(role.getIsActive()).toBe(false);
    expect(() => role.ensureDeletable()).not.toThrow();
  });

  it('rechaza nombres vacíos', () => {
    expect(() =>
      Role.create({ name: '  ', area: null, permissions: [], createdBy: null }),
    ).toThrow(DomainError);
  });
});
