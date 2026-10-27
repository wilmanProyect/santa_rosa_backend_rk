import { Inject, Injectable } from '@nestjs/common';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { GetAnimalPhotoUseCase } from './get-animal-photo.use-case';

/**
 * Borrado lógico: el registro (quién la subió y quién la eliminó) y los
 * archivos en el almacenamiento se conservan, para no perder el historial.
 */
@Injectable()
export class DeleteAnimalPhotoUseCase {
  constructor(
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
    private readonly getAnimalPhotoUseCase: GetAnimalPhotoUseCase,
  ) {}

  async execute(
    actorId: string,
    animalId: string,
    photoId: string,
  ): Promise<void> {
    const photo = await this.getAnimalPhotoUseCase.execute(animalId, photoId);
    await this.photoRepository.softDelete(photo, actorId);
  }
}
