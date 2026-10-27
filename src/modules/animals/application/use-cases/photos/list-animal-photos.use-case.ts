import { Inject, Injectable } from '@nestjs/common';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';
import { GetAnimalUseCase } from '../animals/get-animal.use-case';

@Injectable()
export class ListAnimalPhotosUseCase {
  constructor(
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  async execute(
    animalId: string,
    pagination: PaginationParams,
  ): Promise<Paginated<AnimalPhoto>> {
    await this.getAnimalUseCase.execute(animalId);
    return this.photoRepository.findPaginated(animalId, pagination);
  }
}
