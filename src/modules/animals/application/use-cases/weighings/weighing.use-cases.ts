import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainError } from '@shared/domain/errors/domain.error';
import { ANIMAL_WEIGHING_REPOSITORY } from '../../../domain/repositories/animal-weighing.repository.interface';
import type {
  IAnimalWeighingRepository,
  PendingWeighing,
} from '../../../domain/repositories/animal-weighing.repository.interface';
import {
  AnimalWeighing,
  SINGLE_WEIGHING_TYPES,
  WeighingType,
  weighingWarnings,
} from '../../../domain/models/animal-weighing.model';
import { Animal } from '../../../domain/models/animal.model';
import { addDays, daysBetween } from '../../../domain/models/animal-event-date';
import { toDateOnly } from '@shared/domain/date-only';
import { GetAnimalUseCase } from '../animals/get-animal.use-case';
import {
  BatchWeighingDto,
  CreateWeighingDto,
  UpdateWeighingDto,
} from '../../dtos/weighing.dto';

export const DUPLICATE_WEIGHING_TYPE = 'DUPLICATE_WEIGHING_TYPE';

const TYPE_LABEL: Partial<Record<WeighingType, string>> = {
  [WeighingType.BIRTH]: 'peso al nacer',
  [WeighingType.WEANING]: 'peso al destete',
};

export interface WeighingWithMetrics {
  weighing: AnimalWeighing;
  /** Edad del animal el día del pesaje. */
  ageDays: number | null;
  /** Ganancia diaria en gramos desde el pesaje anterior. */
  dailyGainG: number | null;
  /** Diferencia en kg con el pesaje anterior. */
  changeKg: number | null;
}

export interface WeighingResult {
  weighing: AnimalWeighing;
  warnings: string[];
}

@Injectable()
export class WeighingService {
  constructor(
    @Inject(ANIMAL_WEIGHING_REPOSITORY)
    private readonly repository: IAnimalWeighingRepository,
    private readonly getAnimal: GetAnimalUseCase,
  ) {}

  async get(animalId: string, id: string): Promise<AnimalWeighing> {
    const weighing = await this.repository.findById(animalId, id);
    if (!weighing) {
      throw new NotFoundException(
        `No se encontró el pesaje con ID "${id}" de este animal`,
      );
    }
    return weighing;
  }

  async list(animalId: string): Promise<WeighingWithMetrics[]> {
    const animal = await this.getAnimal.execute(animalId);
    const weighings = await this.repository.findByAnimal(animalId);
    return withMetrics(animal, weighings);
  }

  async create(
    actorId: string,
    animalId: string,
    dto: CreateWeighingDto,
  ): Promise<WeighingResult> {
    const animal = await this.getAnimal.execute(animalId);
    const weighing = AnimalWeighing.create({
      animal,
      data: dto,
      createdBy: actorId,
      now: new Date(),
    });
    await this.assertSingleType(weighing);
    await this.repository.save(weighing);
    return { weighing, warnings: await this.warningsFor(weighing) };
  }

  async update(
    actorId: string,
    animalId: string,
    id: string,
    dto: UpdateWeighingDto,
  ): Promise<WeighingResult> {
    const animal = await this.getAnimal.execute(animalId);
    const weighing = await this.get(animalId, id);
    weighing.update(dto, animal, new Date());
    if (dto.type !== undefined) await this.assertSingleType(weighing);
    weighing.markUpdatedBy(actorId);
    await this.repository.save(weighing);
    return { weighing, warnings: await this.warningsFor(weighing) };
  }

  async delete(actorId: string, animalId: string, id: string): Promise<void> {
    await this.get(animalId, id);
    await this.repository.softDelete(id, actorId);
  }

  /** Todo o nada: si un animal no cumple las reglas no se guarda ninguno. */
  async batch(
    actorId: string,
    dto: BatchWeighingDto,
  ): Promise<WeighingResult[]> {
    const ids = dto.items.map((i) => i.animalId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay animales repetidos en el lote');
    }

    const now = new Date();
    const errors: { animalId: string; message: string }[] = [];
    const results: WeighingResult[] = [];
    for (const item of dto.items) {
      try {
        const animal = await this.getAnimal.execute(item.animalId);
        const notes = [dto.notes, item.notes].filter(Boolean).join(' · ');
        const weighing = AnimalWeighing.create({
          animal,
          data: {
            weighedAt: dto.weighedAt,
            type: dto.type,
            weightKg: item.weightKg,
            bodyConditionScore: item.bodyConditionScore ?? null,
            isEstimated: item.isEstimated ?? false,
            nextWeighingAt: dto.nextWeighingAt ?? null,
            notes: notes || null,
          },
          createdBy: actorId,
          now,
        });
        await this.assertSingleType(weighing);
        results.push({ weighing, warnings: await this.warningsFor(weighing) });
      } catch (error) {
        if (
          error instanceof DomainError ||
          error instanceof NotFoundException ||
          error instanceof ConflictException
        ) {
          errors.push({ animalId: item.animalId, message: messageOf(error) });
        } else {
          throw error;
        }
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `No se guardó ningún pesaje: ${errors.length} animal(es) con errores`,
        errors,
      });
    }
    await this.repository.saveMany(results.map((r) => r.weighing));
    return results;
  }

  pending(until?: string): Promise<PendingWeighing[]> {
    return this.repository.findPending(
      until ?? addDays(toDateOnly(new Date()), 7),
    );
  }

  private async assertSingleType(weighing: AnimalWeighing): Promise<void> {
    if (!SINGLE_WEIGHING_TYPES.includes(weighing.getType())) return;
    const exists = await this.repository.existsOfType(
      weighing.getAnimalId(),
      weighing.getType(),
      weighing.getId(),
    );
    if (exists) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: DUPLICATE_WEIGHING_TYPE,
        message: `El animal ya tiene registrado el ${TYPE_LABEL[weighing.getType()]}. Corrija ese pesaje en lugar de crear otro.`,
      });
    }
  }

  private async warningsFor(weighing: AnimalWeighing): Promise<string[]> {
    const previous = await this.repository.findPrevious(
      weighing.getAnimalId(),
      weighing.getWeighedAt(),
      weighing.getId(),
    );
    return weighingWarnings(weighing, previous);
  }
}

export function withMetrics(
  animal: Animal,
  weighings: AnimalWeighing[],
): WeighingWithMetrics[] {
  const birthDate = animal.getBirthDate();
  return weighings.map((weighing, index) => {
    const previous = index > 0 ? weighings[index - 1] : null;
    const days = previous
      ? daysBetween(previous.getWeighedAt(), weighing.getWeighedAt())
      : 0;
    const changeKg = previous
      ? Math.round((weighing.getWeightKg() - previous.getWeightKg()) * 100) /
        100
      : null;
    return {
      weighing,
      ageDays: birthDate
        ? daysBetween(birthDate, weighing.getWeighedAt())
        : null,
      changeKg,
      dailyGainG:
        changeKg !== null && days > 0
          ? Math.round((changeKg * 1000) / days)
          : null,
    };
  });
}

function messageOf(error: unknown): string {
  if (error instanceof DomainError) return error.message;
  const response = (error as { getResponse?: () => unknown }).getResponse?.();
  if (response && typeof response === 'object' && 'message' in response) {
    return String(response.message);
  }
  return (error as Error).message;
}
