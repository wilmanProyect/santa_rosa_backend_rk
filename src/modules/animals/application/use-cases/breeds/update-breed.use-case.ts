import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { BREED_REPOSITORY } from '../../../domain/repositories/breed.repository.interface';
import type { IBreedRepository } from '../../../domain/repositories/breed.repository.interface';
import { Breed } from '../../../domain/models/breed.model';
import { UpdateBreedDto } from '../../dtos/update-breed.dto';
import { GetBreedUseCase } from './get-breed.use-case';

@Injectable()
export class UpdateBreedUseCase {
  constructor(
    @Inject(BREED_REPOSITORY)
    private readonly breedRepository: IBreedRepository,
    private readonly getBreedUseCase: GetBreedUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateBreedDto,
  ): Promise<Breed> {
    const breed = await this.getBreedUseCase.execute(id);

    if (dto.species !== undefined && dto.species !== breed.getSpecies()) {
      const animals = await this.breedRepository.countAnimals(id);
      if (animals > 0) {
        throw new ConflictException(
          `No se puede cambiar la especie de la raza: la tienen ${animals} animal(es)`,
        );
      }
      breed.changeSpecies(dto.species);
    }
    if (dto.name !== undefined) {
      breed.rename(dto.name);
    }

    if (dto.species !== undefined || dto.name !== undefined) {
      const existing = await this.breedRepository.findByName(
        breed.getSpecies(),
        breed.getName(),
      );
      if (existing && existing.getId() !== id) {
        throw new ConflictException(
          `Ya existe la raza "${existing.getName()}" para esa especie`,
        );
      }
    }

    if (dto.isActive === true) {
      breed.activate();
    } else if (dto.isActive === false) {
      breed.deactivate();
    }

    breed.markUpdatedBy(actorId);
    await this.breedRepository.save(breed);
    return breed;
  }
}
