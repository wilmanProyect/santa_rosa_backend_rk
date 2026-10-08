import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AREA_REPOSITORY } from '../../domain/repositories/area.repository.interface';
import type { IAreaRepository } from '../../domain/repositories/area.repository.interface';
import { Area } from '../../domain/models/area.model';
import { CreateAreaDto } from '../dtos/create-area.dto';

@Injectable()
export class CreateAreaUseCase {
  constructor(
    @Inject(AREA_REPOSITORY)
    private readonly areaRepository: IAreaRepository,
  ) {}

  async execute(actorId: string, dto: CreateAreaDto): Promise<Area> {
    const existing = await this.areaRepository.findByName(dto.name.trim());
    if (existing) {
      throw new ConflictException(
        `Ya existe un área con el nombre "${dto.name}"`,
      );
    }

    const area = Area.create({
      name: dto.name,
      description: dto.description,
      createdBy: actorId,
    });
    await this.areaRepository.save(area);
    return area;
  }
}
