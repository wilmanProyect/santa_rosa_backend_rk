import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';

@Injectable()
export class GetAnimalUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
  ) {}

  async execute(id: string): Promise<Animal> {
    const animal = await this.animalRepository.findById(id);
    if (!animal) {
      throw new NotFoundException(`No se encontró el animal con ID "${id}"`);
    }
    return animal;
  }
}
