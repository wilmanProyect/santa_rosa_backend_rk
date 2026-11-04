import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { HEALTH_RECORD_REPOSITORY } from '../../../domain/repositories/health-record.repository.interface';
import type { IHealthRecordRepository } from '../../../domain/repositories/health-record.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { AnimalStatus } from '../../../domain/enums/animal.enums';
import { toDateOnly } from '@shared/domain/date-only';
import { ChangeAnimalStatusDto } from '../../dtos/change-animal-status.dto';
import { GetAnimalUseCase } from './get-animal.use-case';

export const WITHDRAWAL_PERIOD = 'WITHDRAWAL_PERIOD';

export interface StatusChangeResult {
  animal: Animal;
  /** Avisos que no impidieron el cambio (p. ej. venta en período de retiro). */
  warnings: string[];
}

@Injectable()
export class ChangeAnimalStatusUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(HEALTH_RECORD_REPOSITORY)
    private readonly healthRepository: IHealthRecordRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  /**
   * Período de retiro (residuos de medicamentos en la carne):
   *  - Faena: se bloquea, salvo que un usuario con permiso la autorice con motivo.
   *  - Venta: se permite, con un aviso (puede venderse en pie para reproducción).
   */
  async execute(
    actor: { id: string; permissions: string[] },
    id: string,
    dto: ChangeAnimalStatusDto,
  ): Promise<StatusChangeResult> {
    const animal = await this.getAnimalUseCase.execute(id);
    const date = dto.date ?? toDateOnly(new Date());
    const warnings: string[] = [];
    let reason = dto.reason ?? null;

    if (
      dto.status === AnimalStatus.SLAUGHTERED ||
      dto.status === AnimalStatus.SOLD
    ) {
      const { meat } = await this.healthRepository.findActiveWithdrawal(
        id,
        date,
      );
      if (meat) {
        const detail = `está en período de retiro de carne por ${meat.productName} (aplicado el ${meat.appliedAt}); podrá faenarse desde el ${meat.endsOn}`;
        if (dto.status === AnimalStatus.SOLD) {
          warnings.push(
            `El animal ${detail}. Si se vende para consumo, informe al comprador.`,
          );
        } else if (!dto.overrideWithdrawal) {
          throw new ConflictException({
            statusCode: 409,
            error: 'Conflict',
            code: WITHDRAWAL_PERIOD,
            message: `No se puede registrar la faena: el animal ${detail}.`,
            withdrawal: meat,
          });
        } else {
          if (
            !actor.permissions.includes(PERMISSIONS.HEALTH_OVERRIDE_WITHDRAWAL)
          ) {
            throw new ForbiddenException(
              `Autorizar una faena en período de retiro requiere el permiso ${PERMISSIONS.HEALTH_OVERRIDE_WITHDRAWAL}`,
            );
          }
          const note = `[Faena autorizada en período de retiro (${meat.productName}, hasta el ${meat.endsOn}): ${dto.overrideReason}]`;
          reason = [note, reason].filter(Boolean).join(' ').slice(0, 500);
          warnings.push(
            `Faena registrada en período de retiro: ${dto.overrideReason}`,
          );
        }
      }
    }

    animal.changeStatus(
      { status: dto.status, date: dto.date ?? null, reason },
      new Date(),
    );

    animal.markUpdatedBy(actor.id);
    await this.animalRepository.save(animal);
    return { animal, warnings };
  }
}
