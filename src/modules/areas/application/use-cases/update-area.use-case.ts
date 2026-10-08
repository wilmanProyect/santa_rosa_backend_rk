import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AREA_REPOSITORY } from '../../domain/repositories/area.repository.interface';
import type { IAreaRepository } from '../../domain/repositories/area.repository.interface';
import { Area } from '../../domain/models/area.model';
import { UpdateAreaDto } from '../dtos/update-area.dto';
import { GetAreaUseCase } from './get-area.use-case';

@Injectable()
export class UpdateAreaUseCase {
  constructor(
    @Inject(AREA_REPOSITORY)
    private readonly areaRepository: IAreaRepository,
    private readonly getAreaUseCase: GetAreaUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateAreaDto,
  ): Promise<Area> {
    const area = await this.getAreaUseCase.execute(id);

    if (dto.name !== undefined) {
      const existing = await this.areaRepository.findByName(dto.name.trim());
      if (existing && existing.getId() !== id) {
        throw new ConflictException(
          `Ya existe un área con el nombre "${dto.name}"`,
        );
      }
      area.rename(dto.name);
    }
    if (dto.description !== undefined) {
      area.updateDescription(dto.description);
    }
    if (dto.isActive === true) {
      area.activate();
    } else if (dto.isActive === false) {
      area.deactivate();
    }

    area.markUpdatedBy(actorId);
    await this.areaRepository.save(area);
    return area;
  }
}
