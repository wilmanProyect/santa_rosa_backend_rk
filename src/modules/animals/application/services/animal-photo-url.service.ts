import { Inject, Injectable } from '@nestjs/common';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import type { IFileStorage } from '@shared/application/ports/file-storage.interface';
import { ANIMAL_PHOTO_REPOSITORY } from '../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../domain/models/animal-photo.model';

export interface PhotoUrls {
  /** Imagen original, para verla en el navegador. */
  url: string;
  /** Imagen original, forzando la descarga con su nombre de archivo. */
  downloadUrl: string;
  /** Miniatura WEBP (máx. 480 px), para galerías y listados. */
  thumbnailUrl: string;
  /** Las URL dejan de funcionar a partir de este momento. */
  urlsExpireAt: Date;
}

export interface PrimaryPhotoSummary {
  id: string;
  thumbnailUrl: string;
  urlsExpireAt: Date;
}

/**
 * URL firmadas y temporales para que el navegador lea las fotos directamente
 * del almacenamiento (Garage). La firma es local: no consulta al almacenamiento.
 */
@Injectable()
export class AnimalPhotoUrlService {
  constructor(
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
  ) {}

  async forPhoto(photo: AnimalPhoto): Promise<PhotoUrls> {
    const file = photo.getFile();
    const [url, downloadUrl, thumbnailUrl] = await Promise.all([
      this.fileStorage.getTemporaryUrl(file.objectKey, {
        fileName: file.originalName,
      }),
      this.fileStorage.getTemporaryUrl(file.objectKey, {
        fileName: file.originalName,
        download: true,
      }),
      this.fileStorage.getTemporaryUrl(file.thumbnailKey),
    ]);
    return { url, downloadUrl, thumbnailUrl, urlsExpireAt: this.expiresAt() };
  }

  /** Miniatura de la foto principal de cada animal (los que no tienen, no aparecen). */
  async primaryPhotos(
    animalIds: string[],
  ): Promise<Map<string, PrimaryPhotoSummary>> {
    const photos = await this.photoRepository.findPrimaryByAnimalIds(animalIds);
    const urlsExpireAt = this.expiresAt();
    const entries = await Promise.all(
      photos.map(
        async (photo) =>
          [
            photo.getAnimalId(),
            {
              id: photo.getId(),
              thumbnailUrl: await this.fileStorage.getTemporaryUrl(
                photo.getFile().thumbnailKey,
              ),
              urlsExpireAt,
            },
          ] as const,
      ),
    );
    return new Map(entries);
  }

  private expiresAt(): Date {
    return new Date(
      Date.now() + this.fileStorage.temporaryUrlTtlSeconds * 1000,
    );
  }
}
