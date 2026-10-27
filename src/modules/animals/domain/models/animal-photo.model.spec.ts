import { DomainError } from '@shared/domain/errors/domain.error';
import { AnimalPhoto, TakenAtSource } from './animal-photo.model';

const NOW = new Date('2026-10-24T12:00:00Z');

const build = (
  overrides: Partial<Parameters<typeof AnimalPhoto.create>[0]> = {},
) =>
  AnimalPhoto.create({
    animalId: 'animal-1',
    file: {
      objectKey: 'animals/a/photos/p/original.jpg',
      thumbnailKey: 'animals/a/photos/p/thumbnail.webp',
      originalName: 'foto.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      width: 800,
      height: 600,
      checksumSha256: 'a'.repeat(64),
    },
    description: null,
    takenAt: null,
    exifTakenAt: null,
    animalBirthDate: '2024-03-01',
    isPrimary: false,
    uploadedBy: { id: 'user-1', username: 'jperez', fullName: 'Juan Pérez' },
    now: NOW,
    ...overrides,
  });

describe('AnimalPhoto', () => {
  it('registra quién y cuándo subió la foto', () => {
    const photo = build();
    expect(photo.getUploadedBy().id).toBe('user-1');
    expect(photo.getUploadedAt()).toBe(NOW);
    expect(photo.getAudit().createdBy).toBe('user-1');
  });

  describe('fecha de la foto', () => {
    it('usa la fecha del EXIF si el usuario no indica una', () => {
      const photo = build({ exifTakenAt: '2025-06-10' });
      expect(photo.getTakenAt()).toBe('2025-06-10');
      expect(photo.getTakenAtSource()).toBe(TakenAtSource.EXIF);
    });

    it('la fecha indicada por el usuario tiene prioridad sobre el EXIF', () => {
      const photo = build({ takenAt: '2025-01-05', exifTakenAt: '2025-06-10' });
      expect(photo.getTakenAt()).toBe('2025-01-05');
      expect(photo.getTakenAtSource()).toBe(TakenAtSource.USER);
    });

    it('ignora una fecha EXIF imposible (reloj de la cámara mal configurado)', () => {
      expect(build({ exifTakenAt: '2010-01-01' }).getTakenAt()).toBeNull();
      expect(build({ exifTakenAt: '2030-01-01' }).getTakenAt()).toBeNull();
    });

    it('rechaza una fecha del usuario futura o anterior al nacimiento', () => {
      expect(() => build({ takenAt: '2026-10-25' })).toThrow(DomainError);
      expect(() => build({ takenAt: '2024-02-28' })).toThrow(DomainError);
    });

    it('se puede corregir o vaciar', () => {
      const photo = build({ exifTakenAt: '2025-06-10' });
      photo.updateDetails({ takenAt: '2025-06-11' }, '2024-03-01', NOW);
      expect(photo.getTakenAtSource()).toBe(TakenAtSource.USER);

      photo.updateDetails({ takenAt: null }, '2024-03-01', NOW);
      expect(photo.getTakenAt()).toBeNull();
      expect(photo.getTakenAtSource()).toBeNull();
    });
  });

  describe('descripción', () => {
    it('recorta espacios y guarda null si queda vacía', () => {
      expect(build({ description: '  Al destete  ' }).getDescription()).toBe(
        'Al destete',
      );
      expect(build({ description: '   ' }).getDescription()).toBeNull();
    });

    it('rechaza más de 500 caracteres', () => {
      expect(() => build({ description: 'x'.repeat(501) })).toThrow(
        DomainError,
      );
    });

    it('al editar solo la fecha, la descripción no cambia', () => {
      const photo = build({ description: 'Vista lateral' });
      photo.updateDetails({ takenAt: '2025-01-01' }, null, NOW);
      expect(photo.getDescription()).toBe('Vista lateral');
    });
  });
});
