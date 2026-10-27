import { Inject, Injectable } from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { ChangeAnimalStatusDto } from '../../dtos/change-animal-status.dto';
import { GetAnimalUseCase } from './get-animal.use-case';

@Injectable()
export class ChangeAnimalStatusUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: ChangeAnimalStatusDto,
  ): Promise<Animal> {
    const animal = await this.getAnimalUseCase.execute(id);

    animal.changeStatus(
      {
        status: dto.status,
        date: dto.date ?? null,
        reason: dto.reason ?? null,
      },
      new Date(),
    );

    animal.markUpdatedBy(actorId);
    await this.animalRepository.save(animal);
    return animal;
  }
}
