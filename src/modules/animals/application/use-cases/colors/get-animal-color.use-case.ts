import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ANIMAL_COLOR_REPOSITORY } from '../../../domain/repositories/animal-color.repository.interface';
import type { IAnimalColorRepository } from '../../../domain/repositories/animal-color.repository.interface';
import { AnimalColor } from '../../../domain/models/animal-color.model';

@Injectable()
export class GetAnimalColorUseCase {
  constructor(
    @Inject(ANIMAL_COLOR_REPOSITORY)
    private readonly colorRepository: IAnimalColorRepository,
  ) {}

  async execute(id: string): Promise<AnimalColor> {
    const color = await this.colorRepository.findById(id);
    if (!color) {
      throw new NotFoundException(`No se encontró el color con ID "${id}"`);
    }
    return color;
  }

  /** Igual que execute, pero además exige que el color esté activo (para asignaciones). */
  async executeActive(id: string): Promise<AnimalColor> {
    const color = await this.execute(id);
    if (!color.getIsActive()) {
      throw new NotFoundException(
        `El color "${color.getName()}" está inactivo`,
      );
    }
    return color;
  }
}
