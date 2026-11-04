import { Animal } from '../../domain/models/animal.model';
import { Breed } from '../../domain/models/breed.model';
import { GeneticCategory, Sex, Species } from '../../domain/enums/animal.enums';
import type { AnimalCertificateData } from '../../application/ports/animal-certificate-renderer.interface';
import {
  formatAge,
  PdfkitAnimalCertificateRenderer,
} from './pdfkit-animal-certificate.renderer';

const NOW = new Date('2026-11-04T15:30:00Z');

const breed = Breed.create({
  species: Species.SHEEP,
  name: 'Merino',
  createdBy: null,
});

const animal = (earTag: string, birthDate: string, sex = Sex.FEMALE) =>
  Animal.create({
    isExternal: false,
    earTag,
    species: Species.SHEEP,
    breed,
    sex,
    geneticCategory: GeneticCategory.PO,
    birthDate,
    createdBy: null,
    now: NOW,
  });

const baseData = (overrides: Partial<AnimalCertificateData> = {}) => {
  const data: AnimalCertificateData = {
    number: 'SR-20261104-ABC123',
    farm: {
      name: 'Cabaña Santa Rosa',
      code: '28-A',
      breeders: ['Ricardo Limpias Mateff', 'Katlyn Los'],
      locality: 'Portachuelo',
      phone: '69405387',
      region: 'Santa Cruz - Bolivia',
    },
    timeZone: 'America/La_Paz',
    issuedAt: NOW,
    issuedBy: { username: 'admin', fullName: 'Administrador' },
    animal: animal('SR-1', '2024-08-14'),
    photoJpeg: null,
    photoTakenAt: null,
    sire: null,
    dam: null,
    offspringCount: 0,
    weights: { birth: null, weaning: null, last: null },
    weighings: [],
    totalWeighings: 0,
    healthRecords: [],
    totalHealthRecords: 0,
    withdrawal: { meat: null, milk: null },
    ...overrides,
  };
  return data;
};

describe('PdfkitAnimalCertificateRenderer', () => {
  const renderer = new PdfkitAnimalCertificateRenderer();

  it('genera un PDF válido aunque el animal no tenga historial', async () => {
    const pdf = await renderer.render(baseData());
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString()).toContain('%%EOF');
  });

  it('incluye la genealogía y el aviso de retiro sin fallar', async () => {
    const sire = animal('P-1', '2019-01-01', Sex.MALE);
    const pdf = await renderer.render(
      baseData({
        sire: { animal: sire, sire: null, dam: null },
        dam: { animal: animal('M-1', '2020-01-01'), sire, dam: null },
        offspringCount: 3,
        withdrawal: {
          meat: {
            endsOn: '2026-11-24',
            productName: 'Ivomec 1%',
            appliedAt: '2026-10-20',
          },
          milk: null,
        },
      }),
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('formatAge', () => {
  it.each([
    ['2024-08-14', '2026-11-04', '2 años y 2 meses'],
    ['2025-11-04', '2026-11-04', '1 año'],
    ['2026-05-10', '2026-11-04', '5 meses'],
    ['2026-10-23', '2026-11-04', '12 días'],
    ['2026-11-03', '2026-11-04', '1 día'],
  ])('de %s a %s → %s', (from, to, expected) => {
    expect(formatAge(from, to)).toBe(expected);
  });

  it('devuelve null si la fecha de referencia es anterior al nacimiento', () => {
    expect(formatAge('2026-11-04', '2026-01-01')).toBeNull();
  });
});
