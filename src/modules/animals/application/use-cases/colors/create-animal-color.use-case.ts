import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ANIMAL_COLOR_REPOSITORY } from '../../../domain/repositories/animal-color.repository.interface';
import type { IAnimalColorRepository } from '../../../domain/repositories/animal-color.repository.interface';
import { AnimalColor } from '../../../domain/models/animal-color.model';
import { CreateAnimalColorDto } from '../../dtos/create-animal-color.dto';

@Injectable()
export class CreateAnimalColorUseCase {
  constructor(
    @Inject(ANIMAL_COLOR_REPOSITORY)
    private readonly colorRepository: IAnimalColorRepository,
  ) {}

  async execute(
    actorId: string,
    dto: CreateAnimalColorDto,
  ): Promise<AnimalColor> {
    const color = AnimalColor.create({ name: dto.name, createdBy: actorId });

    const existing = await this.colorRepository.findByName(color.getName());
    if (existing) {
      throw new ConflictException(`Ya existe el color "${existing.getName()}"`);
    }

    await this.colorRepository.save(color);
    return color;
  }
}
