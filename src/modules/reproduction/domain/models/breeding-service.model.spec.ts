import { DomainError } from '@shared/domain/errors/domain.error';
import { Animal } from '@modules/animals/domain/models/animal.model';
import { Breed } from '@modules/animals/domain/models/breed.model';
import { Sex, Species } from '@modules/animals/domain/enums/animal.enums';
import {
  PregnancyCheckMethod,
  PregnancyCheckResult,
  ServiceStatus,
  ServiceType,
} from '../enums/reproduction.enums';
import { BreedingService } from './breeding-service.model';

const NOW = new Date('2026-11-12T12:00:00Z');
const breed = Breed.create({
  species: Species.SHEEP,
  name: 'Santa Inés',
  createdBy: null,
});
const animal = (earTag: string, sex: Sex) =>
  Animal.create({
    isExternal: false,
    earTag,
    species: Species.SHEEP,
    breed,
    sex,
    birthDate: '2023-01-01',
    createdBy: null,
    now: NOW,
  });
const dam = animal('10', Sex.FEMALE);
const sire = animal('135', Sex.MALE);

const service = (serviceDate: string, exitDate?: string | null) =>
  BreedingService.create({
    dam,
    sire,
    type: ServiceType.DIRECTED,
    serviceDate,
    exitDate,
    inbreedingCoefficient: 0,
    kinshipOverride: null,
    expectedOffspringCategory: null,
    createdBy: 'u1',
    now: NOW,
  });

describe('BreedingService: fecha de salida', () => {
  it('es opcional y el parto probable se cuenta desde el ingreso', () => {
    expect(service('2026-09-01').getExitDate()).toBeNull();
    const s = service('2026-09-01', '2026-09-03');
    expect(s.getExitDate()).toBe('2026-09-03');
    expect(s.getExpectedBirthDate()).toBe('2027-01-26');
  });

  it('no puede ser anterior al ingreso, futura ni muy lejana', () => {
    expect(() => service('2026-09-03', '2026-09-01')).toThrow(DomainError);
    expect(() => service('2026-11-10', '2026-11-13')).toThrow(DomainError);
    expect(() => service('2026-08-01', '2026-09-15')).toThrow(/30 días/);
  });

  it('al corregir el ingreso, la salida vigente debe seguir siendo válida', () => {
    const s = service('2026-09-01', '2026-09-03');
    expect(() =>
      s.update({ serviceDate: '2026-09-05' }, dam, sire, NOW),
    ).toThrow(DomainError);
    s.update(
      { serviceDate: '2026-09-05', exitDate: '2026-09-07' },
      dam,
      sire,
      NOW,
    );
    expect(s.getExitDate()).toBe('2026-09-07');
    s.update({ exitDate: null }, dam, sire, NOW);
    expect(s.getExitDate()).toBeNull();
  });
});

describe('BreedingService: muerte de la madre durante la gestación', () => {
  const pregnantOn = (s: BreedingService, date: string, fetusCount?: number) =>
    s.addCheck(
      {
        checkedAt: date,
        method: PregnancyCheckMethod.ULTRASOUND,
        result: PregnancyCheckResult.PREGNANT,
        fetusCount,
      },
      'u1',
      NOW,
    );

  it('cierra la monta preñada y guarda los fetos de la última ecografía', () => {
    const s = service('2026-08-01');
    pregnantOn(s, '2026-09-10', 2);
    s.recordDamDeath({ date: '2026-10-05', cause: ' Toxemia ' }, NOW);
    expect(s.getStatus()).toBe(ServiceStatus.DAM_DIED);
    expect(s.getDamDeath()).toEqual({
      date: '2026-10-05',
      cause: 'Toxemia',
      confirmedPregnancy: true,
      lostFetuses: 2,
    });
  });

  it('se puede registrar antes del diagnóstico, sin preñez confirmada', () => {
    const s = service('2026-10-01');
    s.recordDamDeath({ date: '2026-10-20', cause: null }, NOW);
    expect(s.getDamDeath()).toMatchObject({
      confirmedPregnancy: false,
      lostFetuses: null,
    });
  });

  it('la monta cerrada no admite diagnóstico, aborto ni parto', () => {
    const s = service('2026-08-01');
    s.recordDamDeath({ date: '2026-10-05', cause: null }, NOW);
    expect(() => pregnantOn(s, '2026-10-06')).toThrow(/murió/);
    expect(() =>
      s.recordAbortion({ date: '2026-10-06', cause: null }, NOW),
    ).toThrow(DomainError);
    expect(() => s.markBirthed('2026-11-01')).toThrow(/murió/);
  });

  it('valida la fecha contra la monta y el último diagnóstico', () => {
    const s = service('2026-08-01');
    pregnantOn(s, '2026-09-10');
    expect(() =>
      s.recordDamDeath({ date: '2026-07-30', cause: null }, NOW),
    ).toThrow(/anterior a la monta/);
    expect(() =>
      s.recordDamDeath({ date: '2026-09-01', cause: null }, NOW),
    ).toThrow(/último diagnóstico/);
    expect(() =>
      s.recordDamDeath({ date: '2026-11-20', cause: null }, NOW),
    ).toThrow(/futura/);
  });

  it('no aplica a una monta vacía, parida o abortada', () => {
    const empty = service('2026-08-01');
    empty.addCheck(
      {
        checkedAt: '2026-09-10',
        method: PregnancyCheckMethod.ULTRASOUND,
        result: PregnancyCheckResult.EMPTY,
      },
      'u1',
      NOW,
    );
    expect(() =>
      empty.recordDamDeath({ date: '2026-10-01', cause: null }, NOW),
    ).toThrow(/vacía/);
    const aborted = service('2026-08-01');
    aborted.recordAbortion({ date: '2026-09-20', cause: null }, NOW);
    expect(() =>
      aborted.recordDamDeath({ date: '2026-10-01', cause: null }, NOW),
    ).toThrow(/aborto/);
  });

  it('al anularla, la monta vuelve al estado de su último diagnóstico', () => {
    const s = service('2026-08-01');
    pregnantOn(s, '2026-09-10');
    s.recordDamDeath({ date: '2026-10-05', cause: null }, NOW);
    s.cancelDamDeath();
    expect(s.getStatus()).toBe(ServiceStatus.PREGNANT);
    expect(s.getDamDeath()).toBeNull();
    expect(() => s.cancelDamDeath()).toThrow(DomainError);
  });
});
