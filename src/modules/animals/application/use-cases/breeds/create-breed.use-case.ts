import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { BREED_REPOSITORY } from '../../../domain/repositories/breed.repository.interface';
import type { IBreedRepository } from '../../../domain/repositories/breed.repository.interface';
import { Breed } from '../../../domain/models/breed.model';
import { CreateBreedDto } from '../../dtos/create-breed.dto';

@Injectable()
export class CreateBreedUseCase {
  constructor(
    @Inject(BREED_REPOSITORY)
    private readonly breedRepository: IBreedRepository,
  ) {}

  async execute(actorId: string, dto: CreateBreedDto): Promise<Breed> {
    const breed = Breed.create({
      species: dto.species,
      name: dto.name,
      createdBy: actorId,
    });

    const existing = await this.breedRepository.findByName(
      breed.getSpecies(),
      breed.getName(),
    );
    if (existing) {
      throw new ConflictException(
        `Ya existe la raza "${existing.getName()}" para esa especie`,
      );
    }

    await this.breedRepository.save(breed);
    return breed;
  }
}
