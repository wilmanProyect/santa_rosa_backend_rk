import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ANIMAL_COLOR_REPOSITORY } from '../../../domain/repositories/animal-color.repository.interface';
import type { IAnimalColorRepository } from '../../../domain/repositories/animal-color.repository.interface';
import { AnimalColor } from '../../../domain/models/animal-color.model';
import { UpdateAnimalColorDto } from '../../dtos/update-animal-color.dto';
import { GetAnimalColorUseCase } from './get-animal-color.use-case';

@Injectable()
export class UpdateAnimalColorUseCase {
  constructor(
    @Inject(ANIMAL_COLOR_REPOSITORY)
    private readonly colorRepository: IAnimalColorRepository,
    private readonly getAnimalColorUseCase: GetAnimalColorUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateAnimalColorDto,
  ): Promise<AnimalColor> {
    const color = await this.getAnimalColorUseCase.execute(id);

    if (dto.name !== undefined) {
      color.rename(dto.name);
      const existing = await this.colorRepository.findByName(color.getName());
      if (existing && existing.getId() !== id) {
        throw new ConflictException(
          `Ya existe el color "${existing.getName()}"`,
        );
      }
    }
    if (dto.isActive === true) {
      color.activate();
    } else if (dto.isActive === false) {
      color.deactivate();
    }

    color.markUpdatedBy(actorId);
    await this.colorRepository.save(color);
    return color;
  }
}
