import { ForbiddenException } from '@nestjs/common';
import { resolveSections } from './export.service';
import { ExportSection } from '../domain/export.types';
import { cell } from '../infrastructure/xlsx-export.builder';

describe('resolveSections', () => {
  const all = ['animals:read', 'health:read', 'reproduction:read'];

  it('sin pedir secciones exporta todas las que el usuario puede ver', () => {
    expect(resolveSections(undefined, all)).toEqual([
      ExportSection.ANIMALS,
      ExportSection.HEALTH,
      ExportSection.SERVICES,
      ExportSection.BIRTHS,
    ]);
    expect(resolveSections([], ['animals:read'])).toEqual([
      ExportSection.ANIMALS,
    ]);
  });

  it('respeta el orden de las hojas aunque se pidan en otro orden', () => {
    expect(
      resolveSections([ExportSection.BIRTHS, ExportSection.ANIMALS], all),
    ).toEqual([ExportSection.ANIMALS, ExportSection.BIRTHS]);
  });

  it('rechaza una sección sin su permiso de lectura', () => {
    expect(() =>
      resolveSections([ExportSection.HEALTH], ['animals:read']),
    ).toThrow(
      new ForbiddenException(
        'No tiene permiso para exportar: Registro sanitario',
      ),
    );
    expect(() => resolveSections(undefined, [])).toThrow(ForbiddenException);
  });
});

describe('cell', () => {
  it('convierte fechas, números, sí/no y etiquetas', () => {
    expect(cell({ key: 'd', kind: 'date' }, { d: '2025-08-14' })).toEqual(
      new Date('2025-08-14T00:00:00Z'),
    );
    expect(cell({ key: 'n', kind: 'money' }, { n: '2500.50' })).toBe(2500.5);
    expect(cell({ key: 'b', kind: 'bool' }, { b: true })).toBe('Sí');
    expect(cell({ key: 'b', kind: 'bool' }, { b: false })).toBe('No');
    expect(cell({ key: 's', labels: { SHEEP: 'Ovino' } }, { s: 'SHEEP' })).toBe(
      'Ovino',
    );
    expect(cell({ key: 'x' }, { x: null })).toBeNull();
  });
});
