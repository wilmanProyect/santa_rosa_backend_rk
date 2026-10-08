import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { AREA_REPOSITORY } from '../../domain/repositories/area.repository.interface';
import type { IAreaRepository } from '../../domain/repositories/area.repository.interface';
import { GetAreaUseCase } from './get-area.use-case';

@Injectable()
export class DeleteAreaUseCase {
  constructor(
    @Inject(AREA_REPOSITORY)
    private readonly areaRepository: IAreaRepository,
    private readonly getAreaUseCase: GetAreaUseCase,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await this.getAreaUseCase.execute(id);

    const usages = await this.areaRepository.countUsages(id);
    if (usages.users > 0 || usages.roles > 0) {
      throw new ConflictException(
        `No se puede eliminar el área: tiene ${usages.users} usuario(s) y ${usages.roles} rol(es) asignados. Desactívela o reasígnelos primero.`,
      );
    }

    await this.areaRepository.softDelete(id, actorId);
  }
}
