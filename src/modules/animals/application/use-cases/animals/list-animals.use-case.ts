import { Inject, Injectable } from '@nestjs/common';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type {
  AnimalFilters,
  IAnimalRepository,
} from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';

@Injectable()
export class ListAnimalsUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
  ) {}

  async execute(
    filters: AnimalFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<Animal>> {
    return this.animalRepository.findPaginated(filters, pagination);
  }
}
