import { Inject, Injectable } from '@nestjs/common';
import { AREA_REPOSITORY } from '../../domain/repositories/area.repository.interface';
import type {
  AreaFilters,
  IAreaRepository,
} from '../../domain/repositories/area.repository.interface';
import { Area } from '../../domain/models/area.model';

@Injectable()
export class ListAreasUseCase {
  constructor(
    @Inject(AREA_REPOSITORY)
    private readonly areaRepository: IAreaRepository,
  ) {}

  async execute(filters: AreaFilters): Promise<Area[]> {
    return this.areaRepository.findAll(filters);
  }
}
