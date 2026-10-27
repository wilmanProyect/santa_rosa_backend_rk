import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ANIMAL_COLOR_REPOSITORY } from '../../../domain/repositories/animal-color.repository.interface';
import type { IAnimalColorRepository } from '../../../domain/repositories/animal-color.repository.interface';
import { GetAnimalColorUseCase } from './get-animal-color.use-case';

@Injectable()
export class DeleteAnimalColorUseCase {
  constructor(
    @Inject(ANIMAL_COLOR_REPOSITORY)
    private readonly colorRepository: IAnimalColorRepository,
    private readonly getAnimalColorUseCase: GetAnimalColorUseCase,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await this.getAnimalColorUseCase.execute(id);

    const animals = await this.colorRepository.countAnimals(id);
    if (animals > 0) {
      throw new ConflictException(
        `No se puede eliminar el color: lo tienen ${animals} animal(es). Desactívelo en su lugar.`,
      );
    }

    await this.colorRepository.softDelete(id, actorId);
  }
}
