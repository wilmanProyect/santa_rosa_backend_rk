import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { toDateOnly } from '@shared/domain/date-only';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import {
  GeneticCategoryChange,
  GeneticCategoryChangeKind,
  newGeneticCategoryChange,
} from '../../../domain/models/genetic-category-change';
import { ConfirmGeneticCategoryDto } from '../../dtos/confirm-genetic-category.dto';
import { GetAnimalUseCase } from './get-animal.use-case';

/**
 * Confirmación de la categoría genética por ABSID y su historial. La categoría
 * esperada la calcula el módulo de reproducción al registrar el parto.
 */
@Injectable()
export class GeneticCategoryService {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    private readonly getAnimal: GetAnimalUseCase,
  ) {}

  async confirm(
    actorId: string,
    animalId: string,
    dto: ConfirmGeneticCategoryDto,
  ): Promise<{ animal: Animal; change: GeneticCategoryChange }> {
    const animal = await this.getAnimal.execute(animalId);
    const category = dto.category ?? animal.getGeneticCategory();
    if (!category) {
      throw new BadRequestException(
        'El animal no tiene categoría esperada: indique la categoría que asignó ABSID',
      );
    }
    const confirmedOn = dto.confirmedOn ?? toDateOnly(new Date());
    if (confirmedOn > toDateOnly(new Date())) {
      throw new BadRequestException(
        'La fecha de confirmación no puede ser futura',
      );
    }
    const birthDate = animal.getBirthDate();
    if (birthDate && confirmedOn < birthDate) {
      throw new BadRequestException(
        `La fecha de confirmación no puede ser anterior al nacimiento (${birthDate})`,
      );
    }

    const previous = animal.confirmGeneticCategory(category);
    if (dto.absidCertificateCode !== undefined) {
      animal.update(
        { absidCertificateCode: dto.absidCertificateCode },
        new Date(),
      );
    }
    animal.markUpdatedBy(actorId);
    const change = newGeneticCategoryChange({
      animalId,
      fromCategory: previous,
      toCategory: category,
      kind: GeneticCategoryChangeKind.CONFIRMED,
      changedOn: confirmedOn,
      absidCertificateCode: dto.absidCertificateCode ?? null,
      notes: dto.notes ?? null,
      createdBy: actorId,
    });
    await this.animalRepository.save(animal, change);
    return { animal, change };
  }

  async history(animalId: string): Promise<GeneticCategoryChange[]> {
    await this.getAnimal.execute(animalId);
    return this.animalRepository.findGeneticCategoryHistory(animalId);
  }
}
