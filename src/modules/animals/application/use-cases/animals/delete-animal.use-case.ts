import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { GetAnimalUseCase } from './get-animal.use-case';

/**
 * Borrado lógico, para registros cargados por error. Las salidas reales del
 * inventario (muerte, venta, etc.) se registran con el cambio de estado.
 */
@Injectable()
export class DeleteAnimalUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await this.getAnimalUseCase.execute(id);

    const offspring = await this.animalRepository.getOffspringStats(id);
    if (offspring.count > 0) {
      throw new ConflictException(
        `No se puede eliminar el animal: tiene ${offspring.count} cría(s) registradas. Para una salida del inventario, cambie su estado.`,
      );
    }

    const breeding = await this.animalRepository.countBreedingRecords(id);
    if (breeding.services > 0 || breeding.births > 0) {
      throw new ConflictException(
        `No se puede eliminar el animal: figura en ${breeding.services} monta(s) y ${breeding.births} parto(s). Elimine primero las montas cargadas por error o, para una salida del inventario, cambie su estado.`,
      );
    }

    await this.animalRepository.softDelete(id, actorId);
  }
}
