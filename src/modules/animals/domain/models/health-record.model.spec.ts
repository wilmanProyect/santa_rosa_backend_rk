import { VeterinaryProduct } from '@modules/veterinary/domain/models/veterinary-product.model';
import {
  DoseUnit,
  ProductCategory,
} from '@modules/veterinary/domain/enums/veterinary.enums';
import { Animal } from './animal.model';
import { Breed } from './breed.model';
import {
  HealthCategory,
  HealthEventType,
  HealthRecord,
} from './health-record.model';
import { Sex, Species } from '../enums/animal.enums';

const NOW = new Date('2026-11-02T12:00:00Z');
const sheepBreed = Breed.create({
  species: Species.SHEEP,
  name: 'Santa Inés',
  createdBy: null,
});
const sheep = () =>
  Animal.create({
    isExternal: false,
    earTag: '10',
    species: Species.SHEEP,
    breed: sheepBreed,
    sex: Sex.MALE,
    birthDate: '2023-07-01',
    createdBy: null,
    now: NOW,
  });

const ivermectin = VeterinaryProduct.create({
  name: 'Ivomec',
  category: ProductCategory.INTERNAL_ANTIPARASITIC,
  doseUnit: DoseUnit.ML,
  meatWithdrawalDays: 28,
  milkWithdrawalDays: 5,
  createdBy: null,
});

const record = (
  overrides: Partial<Parameters<typeof HealthRecord.create>[0]> = {},
  data: Partial<Parameters<typeof HealthRecord.create>[0]['data']> = {},
) =>
  HealthRecord.create({
    animal: sheep(),
    product: null,
    data: {
      type: HealthEventType.INTERNAL_DEWORMING,
      appliedAt: '2026-05-05',
      ...data,
    },
    createdBy: 'user-1',
    now: NOW,
    ...overrides,
  });

describe('HealthRecord', () => {
  it('agrupa los tipos por categoría', () => {
    expect(record().getCategory()).toBe(HealthCategory.SANITARY);
    expect(record({}, { type: HealthEventType.SHEARING }).getCategory()).toBe(
      HealthCategory.MANAGEMENT,
    );
  });

  it('calcula el fin del período de retiro con los días del producto al aplicarlo', () => {
    const r = record({ product: ivermectin });
    expect(r.getMeatWithdrawalEndsOn()).toBe('2026-06-02');
    expect(r.getMilkWithdrawalEndsOn()).toBe('2026-05-10');

    // Cambiar el catálogo después no altera el historial.
    ivermectin.update({ meatWithdrawalDays: 60 });
    expect(r.getMeatWithdrawalEndsOn()).toBe('2026-06-02');
    ivermectin.update({ meatWithdrawalDays: 28 });
  });

  it('sin producto o con retiro 0 no hay período de retiro', () => {
    expect(record().getMeatWithdrawalEndsOn()).toBeNull();
  });

  it('la limpieza de corral es un evento general, sin animal', () => {
    const cleaning = record(
      { animal: null },
      { type: HealthEventType.CORRAL_CLEANING, location: 'Corral 2' },
    );
    expect(cleaning.getAnimalId()).toBeNull();
    expect(cleaning.getCategory()).toBe(HealthCategory.FACILITY);

    expect(() => record({}, { type: HealthEventType.CORRAL_CLEANING })).toThrow(
      'no se asocian a un animal',
    );
    expect(() => record({ animal: null })).toThrow('Indique el animal');
  });

  it('valida dosis, fechas y especie del producto', () => {
    expect(() => record({}, { doseQuantity: 6 })).toThrow(
      'junto con su unidad',
    );
    expect(() => record({}, { appliedAt: '2023-01-01' })).toThrow(
      'anterior al nacimiento',
    );
    expect(() => record({}, { nextDoseAt: '2026-05-05' })).toThrow(
      'próxima dosis',
    );

    const goatsOnly = VeterinaryProduct.create({
      name: 'Solo caprinos',
      category: ProductCategory.OTHER,
      forSheep: false,
      createdBy: null,
    });
    expect(() => record({ product: goatsOnly })).toThrow(
      'no está autorizado para ovinos',
    );
  });

  it('admite fechas estimadas (planillas sin fecha)', () => {
    expect(record({}, { isDateEstimated: true }).getIsDateEstimated()).toBe(
      true,
    );
  });
});

describe('VeterinaryProduct', () => {
  it('exige al menos una especie y días de retiro válidos', () => {
    expect(() =>
      VeterinaryProduct.create({
        name: 'X',
        category: ProductCategory.OTHER,
        forSheep: false,
        forGoats: false,
        createdBy: null,
      }),
    ).toThrow('al menos para ovinos o para caprinos');
    expect(() =>
      VeterinaryProduct.create({
        name: 'X',
        category: ProductCategory.OTHER,
        meatWithdrawalDays: -1,
        createdBy: null,
      }),
    ).toThrow('retiro de carne');
  });
});
