import { DomainError } from '@shared/domain/errors/domain.error';
import { Animal } from './animal.model';
import { Breed } from './breed.model';
import {
  AnimalStatus,
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '../enums/animal.enums';

const NOW = new Date('2026-10-20T12:00:00Z');

const merino = Breed.create({
  species: Species.SHEEP,
  name: 'Merino',
  createdBy: null,
});
const saanen = Breed.create({
  species: Species.GOAT,
  name: 'Saanen',
  createdBy: null,
});

type CreateParams = Parameters<typeof Animal.create>[0];

const buildAnimal = (overrides: Partial<CreateParams> = {}) =>
  Animal.create({
    isExternal: false,
    earTag: ' sr-001 ',
    species: Species.SHEEP,
    breed: merino,
    sex: Sex.FEMALE,
    geneticCategory: GeneticCategory.PO,
    birthDate: '2024-05-10',
    createdBy: null,
    now: NOW,
    ...overrides,
  });

const parentOf = (animal: Animal) => animal.toParent();

describe('Animal', () => {
  describe('alta', () => {
    it('por defecto es nacido en la cabaña, vivo y con el arete normalizado', () => {
      const animal = buildAnimal();

      expect(animal.getEntryOrigin()).toBe(EntryOrigin.BORN_ON_FARM);
      expect(animal.getStatus()).toBe(AnimalStatus.ALIVE);
      expect(animal.getEarTag()).toBe('SR-001');
      expect(animal.isInInventory()).toBe(true);
    });

    it('exige arete y categoría genética en los animales de la cabaña', () => {
      expect(() => buildAnimal({ earTag: '  ' })).toThrow(DomainError);
      expect(() => buildAnimal({ geneticCategory: null })).toThrow(DomainError);
    });

    it('rechaza una raza de otra especie', () => {
      expect(() => buildAnimal({ breed: saanen })).toThrow(
        'no corresponde a la especie',
      );
    });

    it('exige la fecha de nacimiento si nació en la cabaña', () => {
      expect(() => buildAnimal({ birthDate: null })).toThrow(DomainError);
    });

    it('un animal comprado requiere fecha de ingreso, no posterior a hoy', () => {
      expect(() =>
        buildAnimal({ entryOrigin: EntryOrigin.PURCHASE, birthDate: null }),
      ).toThrow('fecha de ingreso es obligatoria');

      const bought = buildAnimal({
        entryOrigin: EntryOrigin.PURCHASE,
        birthDate: null,
        entryDate: '2026-03-02',
        sourceFarm: 'Cabaña San Isidro',
      });
      expect(bought.getSourceFarm()).toBe('Cabaña San Isidro');

      expect(() =>
        buildAnimal({
          entryOrigin: EntryOrigin.PURCHASE,
          entryDate: '2027-01-01',
        }),
      ).toThrow('no puede ser futura');
    });

    it('un nacido en la cabaña no tiene cabaña de procedencia', () => {
      expect(() => buildAnimal({ sourceFarm: 'Otra cabaña' })).toThrow(
        DomainError,
      );
    });

    it('valida el orden de las fechas y los pesos', () => {
      expect(() => buildAnimal({ weaningDate: '2024-01-01' })).toThrow(
        'anterior a la fecha de nacimiento',
      );
      expect(() => buildAnimal({ weaningWeightKg: 20 })).toThrow(
        'fecha de destete junto con el peso',
      );
      expect(() => buildAnimal({ birthWeightKg: 0 })).toThrow('mayor a cero');
    });
  });

  describe('animales externos', () => {
    it('no necesitan arete ni categoría y no forman parte del inventario', () => {
      const donor = buildAnimal({
        isExternal: true,
        earTag: null,
        geneticCategory: null,
        name: 'Donante 55120',
        sex: Sex.MALE,
        birthDate: null,
        externalRegistry: 'aus-mer-55120',
      });

      expect(donor.getEntryOrigin()).toBeNull();
      expect(donor.getExternalRegistry()).toBe('AUS-MER-55120');
      expect(donor.isInInventory()).toBe(false);
    });

    it('deben tener al menos un dato que los identifique', () => {
      expect(() =>
        buildAnimal({
          isExternal: true,
          earTag: null,
          geneticCategory: null,
          sex: Sex.MALE,
        }),
      ).toThrow('al menos arete, nombre');
    });

    it('no admiten datos de ingreso ni cambios de estado', () => {
      expect(() =>
        buildAnimal({ isExternal: true, entryOrigin: EntryOrigin.PURCHASE }),
      ).toThrow(DomainError);

      const donor = buildAnimal({ isExternal: true, sex: Sex.MALE });
      expect(() =>
        donor.changeStatus(
          { status: AnimalStatus.DEAD, date: '2026-01-01', reason: null },
          NOW,
        ),
      ).toThrow(DomainError);
    });
  });

  describe('genealogía', () => {
    const dam = buildAnimal({ earTag: 'M-1', birthDate: '2020-01-01' });
    const sire = buildAnimal({
      earTag: 'P-1',
      sex: Sex.MALE,
      birthDate: '2019-01-01',
    });

    it('acepta madre hembra y padre macho de la misma especie', () => {
      const lamb = buildAnimal({ dam: parentOf(dam), sire: parentOf(sire) });
      expect(lamb.getDam()?.id).toBe(dam.getId());
      expect(lamb.getSire()?.id).toBe(sire.getId());
    });

    it('rechaza el sexo invertido', () => {
      expect(() => buildAnimal({ dam: parentOf(sire) })).toThrow(
        'La madre debe ser hembra',
      );
      expect(() => buildAnimal({ sire: parentOf(dam) })).toThrow(
        'El padre debe ser macho',
      );
    });

    it('rechaza padres de otra especie', () => {
      const goat = buildAnimal({
        species: Species.GOAT,
        breed: saanen,
        birthDate: '2020-01-01',
      });
      expect(() => buildAnimal({ dam: parentOf(goat) })).toThrow(
        'misma especie',
      );
    });

    it('rechaza padres nacidos después de la cría', () => {
      const young = buildAnimal({ birthDate: '2025-01-01' });
      expect(() => buildAnimal({ dam: parentOf(young) })).toThrow(
        'nacido antes que la cría',
      );
    });

    it('rechaza que el animal sea su propia madre', () => {
      const animal = buildAnimal();
      expect(() => animal.update({ dam: parentOf(animal) }, NOW)).toThrow(
        'su propia madre',
      );
    });
  });

  describe('estado', () => {
    it('registra la salida con fecha y motivo, y se puede revertir', () => {
      const animal = buildAnimal();

      animal.changeStatus(
        {
          status: AnimalStatus.SOLD,
          date: '2026-10-01',
          reason: ' Vendido a El Porvenir ',
        },
        NOW,
      );
      expect(animal.getStatus()).toBe(AnimalStatus.SOLD);
      expect(animal.getStatusReason()).toBe('Vendido a El Porvenir');
      expect(animal.isInInventory()).toBe(false);

      animal.changeStatus(
        { status: AnimalStatus.ALIVE, date: null, reason: 'ignorado' },
        NOW,
      );
      expect(animal.getStatusDate()).toBeNull();
      expect(animal.getStatusReason()).toBeNull();
    });

    it('exige la fecha y que no sea anterior al nacimiento', () => {
      const animal = buildAnimal();
      expect(() =>
        animal.changeStatus(
          { status: AnimalStatus.DEAD, date: null, reason: null },
          NOW,
        ),
      ).toThrow('Indique la fecha');
      expect(() =>
        animal.changeStatus(
          { status: AnimalStatus.DEAD, date: '2023-01-01', reason: null },
          NOW,
        ),
      ).toThrow('anterior a la fecha de nacimiento');
    });
  });

  describe('caso especial (arete o ABSID repetido)', () => {
    it('exige el motivo', () => {
      expect(() => buildAnimal({ identifierException: true })).toThrow(
        'motivo del caso especial',
      );
      const animal = buildAnimal({
        identifierException: true,
        identifierExceptionReason: ' Así figura en la planilla ',
      });
      expect(animal.getIdentifierExceptionReason()).toBe(
        'Así figura en la planilla',
      );
    });

    it('al quitarlo se borra el motivo', () => {
      const animal = buildAnimal({
        identifierException: true,
        identifierExceptionReason: 'Planilla',
      });
      animal.update({ identifierException: false }, NOW);
      expect(animal.getIdentifierExceptionReason()).toBeNull();
    });
  });

  it('al reemplazar el certificado devuelve el archivo anterior', () => {
    const animal = buildAnimal();
    const file = (key: string) => ({
      key,
      originalName: 'cert.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
      uploadedAt: NOW,
    });

    expect(animal.attachCertificateFile(file('a'))).toBeNull();
    expect(animal.attachCertificateFile(file('b'))?.key).toBe('a');
    expect(animal.removeCertificateFile()?.key).toBe('b');
    expect(animal.getCertificateFile()).toBeNull();
  });
});
