import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { BREED_REPOSITORY } from '../../../domain/repositories/breed.repository.interface';
import type { IBreedRepository } from '../../../domain/repositories/breed.repository.interface';
import { Breed } from '../../../domain/models/breed.model';

@Injectable()
export class GetBreedUseCase {
  constructor(
    @Inject(BREED_REPOSITORY)
    private readonly breedRepository: IBreedRepository,
  ) {}

  async execute(id: string): Promise<Breed> {
    const breed = await this.breedRepository.findById(id);
    if (!breed) {
      throw new NotFoundException(`No se encontró la raza con ID "${id}"`);
    }
    return breed;
  }

  /** Igual que execute, pero además exige que la raza esté activa (para asignaciones). */
  async executeActive(id: string): Promise<Breed> {
    const breed = await this.execute(id);
    if (!breed.getIsActive()) {
      throw new NotFoundException(`La raza "${breed.getName()}" está inactiva`);
    }
    return breed;
  }
}
