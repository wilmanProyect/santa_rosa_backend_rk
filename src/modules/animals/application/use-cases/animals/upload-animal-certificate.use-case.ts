import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { StoredFile } from '@shared/domain/stored-file';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import type { IFileStorage } from '@shared/application/ports/file-storage.interface';
import {
  detectDocumentFileType,
  sanitizeFileName,
} from '@shared/application/document-file-type';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { GetAnimalUseCase } from './get-animal.use-case';

export const CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

/** Guarda (o reemplaza) el archivo escaneado del certificado ABSID. */
@Injectable()
export class UploadAnimalCertificateUseCase {
  private readonly logger = new Logger(UploadAnimalCertificateUseCase.name);

  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    upload: { content: Buffer; originalName: string },
  ): Promise<Animal> {
    const animal = await this.getAnimalUseCase.execute(id);

    const type = detectDocumentFileType(upload.content);
    if (!type) {
      throw new BadRequestException(
        'El certificado debe ser un PDF o una imagen JPG, PNG o WEBP',
      );
    }

    const file: StoredFile = {
      key: `animals/${id}/certificate-${new UUID().getValue()}.${type.extension}`,
      originalName: sanitizeFileName(
        upload.originalName,
        `certificado.${type.extension}`,
      ),
      mimeType: type.mimeType,
      sizeBytes: upload.content.length,
      uploadedAt: new Date(),
    };

    // Primero el archivo, después la BD: si falla la BD se borra el archivo
    // nuevo y el registro sigue apuntando al anterior.
    await this.fileStorage.save(file.key, upload.content, file.mimeType);
    const previous = animal.attachCertificateFile(file);
    animal.markUpdatedBy(actorId);
    try {
      await this.animalRepository.save(animal);
    } catch (error) {
      await this.deleteQuietly(file.key);
      throw error;
    }

    if (previous) {
      await this.deleteQuietly(previous.key);
    }
    return animal;
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
