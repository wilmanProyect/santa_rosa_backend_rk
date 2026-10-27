import { Inject, Injectable } from '@nestjs/common';
import { ANIMAL_COLOR_REPOSITORY } from '../../../domain/repositories/animal-color.repository.interface';
import type {
  AnimalColorFilters,
  IAnimalColorRepository,
} from '../../../domain/repositories/animal-color.repository.interface';
import { AnimalColor } from '../../../domain/models/animal-color.model';

@Injectable()
export class ListAnimalColorsUseCase {
  constructor(
    @Inject(ANIMAL_COLOR_REPOSITORY)
    private readonly colorRepository: IAnimalColorRepository,
  ) {}

  async execute(filters: AnimalColorFilters): Promise<AnimalColor[]> {
    return this.colorRepository.findAll(filters);
  }
}
