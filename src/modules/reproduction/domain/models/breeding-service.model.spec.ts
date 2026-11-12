import { DomainError } from '@shared/domain/errors/domain.error';
import { Animal } from '@modules/animals/domain/models/animal.model';
import { Breed } from '@modules/animals/domain/models/breed.model';
import { Sex, Species } from '@modules/animals/domain/enums/animal.enums';
import { ServiceType } from '../enums/reproduction.enums';
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
