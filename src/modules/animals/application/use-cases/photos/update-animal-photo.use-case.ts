import { Inject, Injectable } from '@nestjs/common';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';
import { UpdateAnimalPhotoDto } from '../../dtos/update-animal-photo.dto';
import { GetAnimalUseCase } from '../animals/get-animal.use-case';
import { GetAnimalPhotoUseCase } from './get-animal-photo.use-case';

/** Corrige la descripción o la fecha. El archivo no se reemplaza nunca. */
@Injectable()
export class UpdateAnimalPhotoUseCase {
  constructor(
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
    private readonly getAnimalPhotoUseCase: GetAnimalPhotoUseCase,
  ) {}

  async execute(
    actorId: string,
    animalId: string,
    photoId: string,
    dto: UpdateAnimalPhotoDto,
  ): Promise<AnimalPhoto> {
    const animal = await this.getAnimalUseCase.execute(animalId);
    const photo = await this.getAnimalPhotoUseCase.execute(animalId, photoId);

    photo.updateDetails(
      { description: dto.description, takenAt: dto.takenAt },
      animal.getBirthDate(),
      new Date(),
    );
    photo.markUpdatedBy(actorId);
    await this.photoRepository.update(photo);
    return photo;
  }
}
