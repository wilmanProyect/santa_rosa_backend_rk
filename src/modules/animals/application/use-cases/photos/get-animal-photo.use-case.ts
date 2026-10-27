import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';

@Injectable()
export class GetAnimalPhotoUseCase {
  constructor(
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
  ) {}

  async execute(animalId: string, photoId: string): Promise<AnimalPhoto> {
    const photo = await this.photoRepository.findById(animalId, photoId);
    if (!photo) {
      throw new NotFoundException(
        `No se encontró la foto con ID "${photoId}" de este animal`,
      );
    }
    return photo;
  }
}
