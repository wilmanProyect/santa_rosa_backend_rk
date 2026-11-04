import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DomainError } from '@shared/domain/errors/domain.error';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { toDateOnly } from '@shared/domain/date-only';
import { GetVeterinaryProductUseCase } from '@modules/veterinary/application/use-cases/veterinary-product.use-cases';
import { VeterinaryProduct } from '@modules/veterinary/domain/models/veterinary-product.model';
import { HEALTH_RECORD_REPOSITORY } from '../../../domain/repositories/health-record.repository.interface';
import type {
  ActiveWithdrawal,
  HealthRecordFilters,
  IHealthRecordRepository,
  PendingDose,
} from '../../../domain/repositories/health-record.repository.interface';
import {
  HealthRecord,
  HealthRecordData,
} from '../../../domain/models/health-record.model';
import { Animal } from '../../../domain/models/animal.model';
import { addDays } from '../../../domain/models/animal-event-date';
import { GetAnimalUseCase } from '../animals/get-animal.use-case';
import {
  BatchHealthRecordDto,
  CreateHealthRecordDto,
  UpdateHealthRecordDto,
} from '../../dtos/health-record.dto';

export interface AnimalWithdrawal {
  meat: ActiveWithdrawal | null;
  milk: ActiveWithdrawal | null;
}

@Injectable()
export class HealthRecordService {
  constructor(
    @Inject(HEALTH_RECORD_REPOSITORY)
    private readonly repository: IHealthRecordRepository,
    private readonly getAnimal: GetAnimalUseCase,
    private readonly getProduct: GetVeterinaryProductUseCase,
  ) {}

  async get(id: string): Promise<HealthRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException(
        `No se encontró el registro sanitario con ID "${id}"`,
      );
    }
    return record;
  }

  list(
    filters: HealthRecordFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<HealthRecord>> {
    return this.repository.findPaginated(filters, pagination);
  }

  async create(
    actorId: string,
    dto: CreateHealthRecordDto,
  ): Promise<HealthRecord> {
    const { animalId, productId, ...fields } = dto;
    const animal = animalId ? await this.getAnimal.execute(animalId) : null;
    const product = productId
      ? await this.getProduct.executeActive(productId)
      : null;
    const record = HealthRecord.create({
      animal,
      product,
      data: withProductDefaults(fields, product),
      createdBy: actorId,
      now: new Date(),
    });
    await this.repository.save(record);
    return record;
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateHealthRecordDto,
  ): Promise<HealthRecord> {
    const record = await this.get(id);
    const animal = record.getAnimalId()
      ? await this.getAnimal.execute(record.getAnimalId()!)
      : null;
    const { productId, ...fields } = dto;

    let product: VeterinaryProduct | null | undefined;
    if (productId === null) product = null;
    else if (productId !== undefined && productId !== record.getProduct()?.id) {
      // Solo se exige que esté activo al cambiarlo por otro.
      product = await this.getProduct.executeActive(productId);
    }

    record.update({ ...fields, product }, animal, new Date());
    record.markUpdatedBy(actorId);
    await this.repository.save(record);
    return record;
  }

  async delete(actorId: string, id: string): Promise<void> {
    await this.get(id);
    await this.repository.softDelete(id, actorId);
  }

  /** Mismo evento para varios animales. Si uno no cumple las reglas, no se guarda ninguno. */
  async batch(
    actorId: string,
    dto: BatchHealthRecordDto,
  ): Promise<HealthRecord[]> {
    const { items, productId, ...fields } = dto;
    const ids = items.map((i) => i.animalId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Hay animales repetidos en la lista');
    }
    const product = productId
      ? await this.getProduct.executeActive(productId)
      : null;

    const now = new Date();
    const records: HealthRecord[] = [];
    const errors: { animalId: string; message: string }[] = [];
    for (const item of items) {
      try {
        const animal = await this.getAnimal.execute(item.animalId);
        const notes = [fields.notes, item.notes].filter(Boolean).join(' · ');
        records.push(
          HealthRecord.create({
            animal,
            product,
            data: withProductDefaults(
              {
                ...fields,
                doseQuantity: item.doseQuantity ?? fields.doseQuantity,
                notes: notes || undefined,
              },
              product,
            ),
            createdBy: actorId,
            now,
          }),
        );
      } catch (error) {
        if (
          error instanceof DomainError ||
          error instanceof NotFoundException
        ) {
          errors.push({ animalId: item.animalId, message: error.message });
        } else {
          throw error;
        }
      }
    }
    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `No se guardó ningún registro: ${errors.length} animal(es) con errores`,
        errors,
      });
    }
    await this.repository.saveMany(records);
    return records;
  }

  /** Período de retiro vigente en esa fecha (por defecto hoy). */
  withdrawal(
    animal: Animal | string,
    onDate?: string,
  ): Promise<AnimalWithdrawal> {
    const id = typeof animal === 'string' ? animal : animal.getId();
    return this.repository.findActiveWithdrawal(
      id,
      onDate ?? toDateOnly(new Date()),
    );
  }

  pending(until?: string): Promise<PendingDose[]> {
    return this.repository.findPendingDoses(
      until ?? addDays(toDateOnly(new Date()), 7),
    );
  }
}

/** Si no se indica la unidad o la vía, se toman las habituales del producto. */
function withProductDefaults<
  T extends Partial<HealthRecordData> &
    Pick<HealthRecordData, 'type' | 'appliedAt'>,
>(fields: T, product: VeterinaryProduct | null): T {
  if (!product) return fields;
  return {
    ...fields,
    doseUnit:
      fields.doseUnit ??
      (fields.doseQuantity != null ? product.getDoseUnit() : undefined) ??
      undefined,
    route: fields.route ?? product.getDefaultRoute() ?? undefined,
  };
}
