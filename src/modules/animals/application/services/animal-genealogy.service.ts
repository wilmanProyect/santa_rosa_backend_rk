import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../domain/repositories/animal.repository.interface';
import { AnimalParent } from '../../domain/models/animal-parent';
import { GetAnimalUseCase } from '../use-cases/animals/get-animal.use-case';

/**
 * Resuelve la madre o el padre indicados por ID. El sexo, la especie y la
 * fecha de nacimiento los valida el modelo Animal; aquí se valida lo que
 * requiere consultar otras filas: que el padre no sea descendiente de la cría.
 */
@Injectable()
export class AnimalGenealogyService {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  /**
   * undefined → sin cambios; null → sin madre/padre.
   * `childId` es null al crear (un animal nuevo no tiene descendientes).
   */
  async resolveParent(
    parentId: string | null | undefined,
    childId: string | null,
  ): Promise<AnimalParent | null | undefined> {
    if (parentId === undefined || parentId === null) return parentId;

    const parent = (await this.getAnimalUseCase.execute(parentId)).toParent();

    if (
      childId &&
      (await this.animalRepository.isDescendant(childId, parentId))
    ) {
      throw new ConflictException(
        `El animal ${describe(parent)} es descendiente de este animal: se formaría un ciclo en la genealogía`,
      );
    }
    return parent;
  }
}

const describe = (parent: AnimalParent) =>
  `"${parent.earTag ?? parent.name ?? parent.id}"`;
