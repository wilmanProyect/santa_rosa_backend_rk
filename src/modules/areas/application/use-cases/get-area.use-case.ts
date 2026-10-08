import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AREA_REPOSITORY } from '../../domain/repositories/area.repository.interface';
import type { IAreaRepository } from '../../domain/repositories/area.repository.interface';
import { Area } from '../../domain/models/area.model';

@Injectable()
export class GetAreaUseCase {
  constructor(
    @Inject(AREA_REPOSITORY)
    private readonly areaRepository: IAreaRepository,
  ) {}

  async execute(id: string): Promise<Area> {
    const area = await this.areaRepository.findById(id);
    if (!area) {
      throw new NotFoundException(`No se encontró el área con ID "${id}"`);
    }
    return area;
  }

  /** Igual que execute, pero además exige que el área esté activa (para asignaciones). */
  async executeActive(id: string): Promise<Area> {
    const area = await this.execute(id);
    if (!area.getIsActive()) {
      throw new NotFoundException(`El área "${area.getName()}" está inactiva`);
    }
    return area;
  }
}
