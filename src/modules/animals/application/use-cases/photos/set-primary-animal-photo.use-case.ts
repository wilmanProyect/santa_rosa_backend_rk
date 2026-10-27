import { Inject, Injectable } from '@nestjs/common';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';
import { GetAnimalPhotoUseCase } from './get-animal-photo.use-case';

@Injectable()
export class SetPrimaryAnimalPhotoUseCase {
  constructor(
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
    private readonly getAnimalPhotoUseCase: GetAnimalPhotoUseCase,
  ) {}

  async execute(
    actorId: string,
    animalId: string,
    photoId: string,
  ): Promise<AnimalPhoto> {
    const photo = await this.getAnimalPhotoUseCase.execute(animalId, photoId);
    if (!photo.getIsPrimary()) {
      await this.photoRepository.setPrimary(photo, actorId);
      photo.markAsPrimary();
      photo.markUpdatedBy(actorId);
    }
    return photo;
  }
}
