import { Inject, Injectable } from '@nestjs/common';
import { BREED_REPOSITORY } from '../../../domain/repositories/breed.repository.interface';
import type {
  BreedFilters,
  IBreedRepository,
} from '../../../domain/repositories/breed.repository.interface';
import { Breed } from '../../../domain/models/breed.model';

@Injectable()
export class ListBreedsUseCase {
  constructor(
    @Inject(BREED_REPOSITORY)
    private readonly breedRepository: IBreedRepository,
  ) {}

  async execute(filters: BreedFilters): Promise<Breed[]> {
    return this.breedRepository.findAll(filters);
  }
}
