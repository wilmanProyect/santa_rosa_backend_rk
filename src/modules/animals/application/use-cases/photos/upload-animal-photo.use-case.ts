import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import type { IFileStorage } from '@shared/application/ports/file-storage.interface';
import { IMAGE_PROCESSOR } from '@shared/application/ports/image-processor.interface';
import type { IImageProcessor } from '@shared/application/ports/image-processor.interface';
import { sanitizeFileName } from '@shared/application/document-file-type';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';
import { UploadAnimalPhotoDto } from '../../dtos/upload-animal-photo.dto';
import { GetAnimalUseCase } from '../animals/get-animal.use-case';
import { GetAnimalPhotoUseCase } from './get-animal-photo.use-case';

export const PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const DUPLICATE_PHOTO = 'DUPLICATE_PHOTO';

@Injectable()
export class UploadAnimalPhotoUseCase {
  private readonly logger = new Logger(UploadAnimalPhotoUseCase.name);

  constructor(
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    @Inject(IMAGE_PROCESSOR)
    private readonly imageProcessor: IImageProcessor,
    private readonly getAnimalUseCase: GetAnimalUseCase,
    private readonly getAnimalPhotoUseCase: GetAnimalPhotoUseCase,
  ) {}

  async execute(
    actor: { id: string; username: string },
    animalId: string,
    upload: { content: Buffer; originalName: string },
    dto: UploadAnimalPhotoDto,
  ): Promise<AnimalPhoto> {
    const animal = await this.getAnimalUseCase.execute(animalId);

    const info = await this.imageProcessor.analyze(upload.content);
    if (!info) {
      throw new BadRequestException(
        'La foto debe ser una imagen JPG, PNG o WEBP. Las fotos HEIC de iPhone deben convertirse a JPG antes de subirlas.',
      );
    }

    const checksumSha256 = createHash('sha256')
      .update(upload.content)
      .digest('hex');
    const existing = await this.photoRepository.findByChecksum(
      animalId,
      checksumSha256,
    );
    if (existing) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: DUPLICATE_PHOTO,
        message: `Esta foto ya está en el historial del animal (subida el ${existing.getUploadedAt().toISOString().slice(0, 10)} por ${existing.getUploadedBy().username})`,
        photoId: existing.getId(),
      });
    }

    const photoId = new UUID().getValue();
    const prefix = `animals/${animalId}/photos/${photoId}`;
    const photo = AnimalPhoto.create({
      id: photoId,
      animalId,
      file: {
        objectKey: `${prefix}/original.${info.extension}`,
        thumbnailKey: `${prefix}/thumbnail.webp`,
        originalName: sanitizeFileName(
          upload.originalName,
          `foto.${info.extension}`,
        ),
        mimeType: info.mimeType,
        sizeBytes: upload.content.length,
        width: info.width,
        height: info.height,
        checksumSha256,
      },
      description: dto.description ?? null,
      takenAt: dto.takenAt ?? null,
      exifTakenAt: info.takenAt,
      animalBirthDate: animal.getBirthDate(),
      // La primera foto del animal pasa a ser la principal.
      isPrimary: (await this.photoRepository.countByAnimal(animalId)) === 0,
      uploadedBy: { id: actor.id, username: actor.username, fullName: '' },
      now: new Date(),
    });

    const thumbnail = await this.imageProcessor.createThumbnail(upload.content);

    // Primero los archivos, después la BD: si falla la BD se borran los
    // archivos para no dejar huérfanos en el almacenamiento.
    const file = photo.getFile();
    await this.fileStorage.save(file.objectKey, upload.content, file.mimeType);
    try {
      await this.fileStorage.save(
        file.thumbnailKey,
        thumbnail.content,
        thumbnail.mimeType,
      );
      await this.photoRepository.create(photo);
    } catch (error) {
      await this.deleteQuietly(file.objectKey);
      await this.deleteQuietly(file.thumbnailKey);
      throw error;
    }

    // Se relee para devolver los datos completos de quien la subió.
    return this.getAnimalPhotoUseCase.execute(animalId, photoId);
  }

  private async deleteQuietly(key: string): Promise<void> {
    try {
      await this.fileStorage.delete(key);
    } catch (error) {
      this.logger.warn(
        `No se pudo borrar el archivo ${key}: ${(error as Error).message}`,
      );
    }
  }
}
