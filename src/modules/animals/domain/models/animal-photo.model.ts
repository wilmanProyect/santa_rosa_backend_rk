import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import { toDateOnly } from '@shared/domain/date-only';

/** Usuario que subió la foto (datos mínimos para mostrarlo). */
export interface PhotoUploader {
  id: string;
  username: string;
  fullName: string;
}

/** Archivo original y su miniatura en el almacenamiento. */
export interface PhotoFile {
  objectKey: string;
  thumbnailKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  /** SHA-256 del archivo original, en hexadecimal. Detecta fotos repetidas. */
  checksumSha256: string;
}

export interface AnimalPhotoProps {
  id: string;
  animalId: string;
  file: PhotoFile;
  /** Fecha en que se tomó la foto (YYYY-MM-DD). */
  takenAt: string | null;
  /** De dónde salió takenAt: lo indicó el usuario o se leyó del EXIF. */
  takenAtSource: TakenAtSource | null;
  description: string | null;
  /** Foto principal del animal (la que se muestra en listados y fichas). */
  isPrimary: boolean;
  uploadedBy: PhotoUploader;
  uploadedAt: Date;
  audit: AuditInfo;
}

export enum TakenAtSource {
  USER = 'USER',
  EXIF = 'EXIF',
}

export const PHOTO_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Foto del historial de un animal. El archivo no cambia nunca: una foto
 * nueva es siempre un registro nuevo, así el historial no se reescribe.
 */
export class AnimalPhoto {
  constructor(private readonly props: AnimalPhotoProps) {}

  static create(params: {
    id?: string;
    animalId: string;
    file: PhotoFile;
    description: string | null;
    /** Fecha indicada por el usuario (tiene prioridad sobre la del EXIF). */
    takenAt: string | null;
    exifTakenAt: string | null;
    /** Nacimiento del animal, para descartar fechas imposibles. */
    animalBirthDate: string | null;
    isPrimary: boolean;
    uploadedBy: PhotoUploader;
    now: Date;
  }): AnimalPhoto {
    const photo = new AnimalPhoto({
      id: params.id ?? new UUID().getValue(),
      animalId: params.animalId,
      file: params.file,
      takenAt: null,
      takenAtSource: null,
      description: null,
      isPrimary: params.isPrimary,
      uploadedBy: params.uploadedBy,
      uploadedAt: params.now,
      audit: newAuditInfo(params.uploadedBy.id),
    });
    photo.updateDetails(
      { description: params.description, takenAt: params.takenAt },
      params.animalBirthDate,
      params.now,
    );

    // La fecha del EXIF depende del reloj de la cámara: si es imposible se
    // ignora en vez de rechazar la foto.
    if (
      photo.props.takenAt === null &&
      params.exifTakenAt &&
      isValidTakenAt(params.exifTakenAt, params.animalBirthDate, params.now)
    ) {
      photo.props.takenAt = params.exifTakenAt;
      photo.props.takenAtSource = TakenAtSource.EXIF;
    }
    return photo;
  }

  public getId(): string {
    return this.props.id;
  }

  public getAnimalId(): string {
    return this.props.animalId;
  }

  public getFile(): PhotoFile {
    return this.props.file;
  }

  public getTakenAt(): string | null {
    return this.props.takenAt;
  }

  public getTakenAtSource(): TakenAtSource | null {
    return this.props.takenAtSource;
  }

  public getDescription(): string | null {
    return this.props.description;
  }

  public getIsPrimary(): boolean {
    return this.props.isPrimary;
  }

  public getUploadedBy(): PhotoUploader {
    return this.props.uploadedBy;
  }

  public getUploadedAt(): Date {
    return this.props.uploadedAt;
  }

  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  /** Aplica solo los campos definidos. null vacía el campo. */
  public updateDetails(
    changes: { description?: string | null; takenAt?: string | null },
    animalBirthDate: string | null,
    now: Date,
  ): void {
    if (changes.description !== undefined) {
      const description = changes.description?.trim() || null;
      if (description && description.length > PHOTO_DESCRIPTION_MAX_LENGTH) {
        throw new DomainError(
          `La descripción no puede superar ${PHOTO_DESCRIPTION_MAX_LENGTH} caracteres`,
        );
      }
      this.props.description = description;
    }

    if (changes.takenAt !== undefined) {
      if (changes.takenAt !== null) {
        if (changes.takenAt > toDateOnly(now)) {
          throw new DomainError('La fecha de la foto no puede ser futura');
        }
        if (animalBirthDate && changes.takenAt < animalBirthDate) {
          throw new DomainError(
            `La fecha de la foto no puede ser anterior al nacimiento del animal (${animalBirthDate})`,
          );
        }
      }
      this.props.takenAt = changes.takenAt;
      this.props.takenAtSource =
        changes.takenAt === null ? null : TakenAtSource.USER;
    }
  }

  public markAsPrimary(): void {
    this.props.isPrimary = true;
  }

  public unmarkAsPrimary(): void {
    this.props.isPrimary = false;
  }

  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }
}

function isValidTakenAt(
  takenAt: string,
  animalBirthDate: string | null,
  now: Date,
): boolean {
  return (
    takenAt <= toDateOnly(now) &&
    (!animalBirthDate || takenAt >= animalBirthDate)
  );
}
