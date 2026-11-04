import { DomainError } from '@shared/domain/errors/domain.error';
import { Animal } from './animal.model';
import { Breed } from './breed.model';
import {
  AnimalWeighing,
  WeighingType,
  weighingWarnings,
} from './animal-weighing.model';
import { withMetrics } from '../../application/use-cases/weighings/weighing.use-cases';
import { AnimalStatus, Sex, Species } from '../enums/animal.enums';

const NOW = new Date('2026-11-02T12:00:00Z');
const breed = Breed.create({
  species: Species.SHEEP,
  name: 'Santa Inés',
  createdBy: null,
});

const lamb = () =>
  Animal.create({
    isExternal: false,
    earTag: 'CSR-100',
    species: Species.SHEEP,
    breed,
    sex: Sex.FEMALE,
    birthDate: '2025-06-01',
    createdBy: null,
    now: NOW,
  });

const weigh = (
  animal: Animal,
  weighedAt: string,
  weightKg: number,
  type = WeighingType.ROUTINE,
  extra: Partial<Parameters<typeof AnimalWeighing.create>[0]['data']> = {},
) =>
  AnimalWeighing.create({
    animal,
    data: { weighedAt, weightKg, type, ...extra },
    createdBy: 'user-1',
    now: NOW,
  });

describe('AnimalWeighing', () => {
  it('registra un pesaje válido', () => {
    const w = weigh(lamb(), '2025-09-01', 18.7, WeighingType.WEANING);
    expect(w.getWeightKg()).toBe(18.7);
    expect(w.getAudit().createdBy).toBe('user-1');
  });

  it('rechaza fechas futuras, anteriores al nacimiento o posteriores a la salida', () => {
    expect(() => weigh(lamb(), '2026-12-01', 20)).toThrow('futura');
    expect(() => weigh(lamb(), '2025-05-01', 20)).toThrow(
      'anterior al nacimiento',
    );

    const sold = lamb();
    sold.changeStatus(
      { status: AnimalStatus.SOLD, date: '2026-01-10', reason: null },
      NOW,
    );
    expect(() => weigh(sold, '2026-02-01', 30)).toThrow(
      'posterior a la salida',
    );
    expect(weigh(sold, '2026-01-10', 30, WeighingType.SALE).getType()).toBe(
      WeighingType.SALE,
    );
  });

  it('no pesa animales externos', () => {
    const donor = Animal.create({
      isExternal: true,
      name: 'Donante',
      species: Species.SHEEP,
      breed,
      sex: Sex.MALE,
      createdBy: null,
      now: NOW,
    });
    expect(() => weigh(donor, '2025-01-01', 80)).toThrow('externos');
  });

  it('valida el peso, la condición corporal y el próximo pesaje', () => {
    expect(() => weigh(lamb(), '2025-09-01', 0)).toThrow(DomainError);
    expect(() =>
      weigh(lamb(), '2025-09-01', 20, WeighingType.ROUTINE, {
        bodyConditionScore: 3.3,
      }),
    ).toThrow('condición corporal');
    expect(() =>
      weigh(lamb(), '2025-09-01', 20, WeighingType.ROUTINE, {
        nextWeighingAt: '2025-09-01',
      }),
    ).toThrow('próximo pesaje');
  });

  it('el peso al nacer se toma dentro de los 7 días del nacimiento', () => {
    expect(weigh(lamb(), '2025-06-03', 3.5, WeighingType.BIRTH)).toBeDefined();
    expect(() => weigh(lamb(), '2025-06-20', 3.5, WeighingType.BIRTH)).toThrow(
      'dentro de los 7 días',
    );
  });

  it('calcula edad, diferencia y ganancia diaria', () => {
    const animal = lamb();
    const metrics = withMetrics(animal, [
      weigh(animal, '2025-06-01', 3.5, WeighingType.BIRTH),
      weigh(animal, '2025-09-09', 23.5, WeighingType.WEANING),
    ]);
    expect(metrics[0]).toMatchObject({ ageDays: 0, dailyGainG: null });
    expect(metrics[1]).toMatchObject({
      ageDays: 100,
      changeKg: 20,
      dailyGainG: 200,
    });
  });

  it('advierte sobre bajas fuertes o ganancias imposibles, sin bloquear', () => {
    const animal = lamb();
    const previous = weigh(animal, '2025-09-01', 20);
    expect(weighingWarnings(weigh(animal, '2025-09-11', 16), previous)).toEqual(
      [expect.stringContaining('Bajó 20 %')],
    );
    expect(weighingWarnings(weigh(animal, '2025-09-11', 30), previous)).toEqual(
      [expect.stringContaining('1000 g/día')],
    );
    expect(weighingWarnings(weigh(animal, '2025-10-01', 24), previous)).toEqual(
      [],
    );
  });
});
