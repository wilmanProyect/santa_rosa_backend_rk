import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { BREED_REPOSITORY } from '../../../domain/repositories/breed.repository.interface';
import type { IBreedRepository } from '../../../domain/repositories/breed.repository.interface';
import { GetBreedUseCase } from './get-breed.use-case';

@Injectable()
export class DeleteBreedUseCase {
  constructor(
    @Inject(BREED_REPOSITORY)
    private readonly breedRepository: IBreedRepository,
    private readonly getBreedUseCase: GetBreedUseCase,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await this.getBreedUseCase.execute(id);

    const animals = await this.breedRepository.countAnimals(id);
    if (animals > 0) {
      throw new ConflictException(
        `No se puede eliminar la raza: la tienen ${animals} animal(es). Desactívela en su lugar.`,
      );
    }

    await this.breedRepository.softDelete(id, actorId);
  }
}
