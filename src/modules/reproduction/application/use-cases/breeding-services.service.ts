import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Paginated } from '@shared/domain/paginated';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { GetAnimalUseCase } from '@modules/animals/application/use-cases/animals/get-animal.use-case';
import { BREEDING_SERVICE_REPOSITORY } from '../../domain/repositories/reproduction.repository.interface';
import type { IBreedingServiceRepository } from '../../domain/repositories/reproduction.repository.interface';
import {
  OPEN_SERVICE_STATUSES,
  ServiceStatus,
} from '../../domain/enums/reproduction.enums';
import {
  BreedingService,
  KinshipOverride,
  PregnancyCheck,
} from '../../domain/models/breeding-service.model';
import { describeAnimal } from '../../domain/models/breeding-animal-ref';
import {
  CreateBreedingServiceDto,
  CreatePregnancyCheckDto,
  ListBreedingServicesQueryDto,
  RecordAbortionDto,
  UpdateBreedingServiceDto,
} from '../dtos/breeding.dto';
import {
  BreedingEvaluation,
  BreedingEvaluationService,
  INVALID_PAIR,
  KINSHIP_CONFLICT,
  OPEN_SERVICE,
} from '../services/breeding-evaluation.service';

export interface Actor {
  id: string;
  permissions: string[];
}

export interface ServiceResult {
  service: BreedingService;
  warnings: string[];
}

@Injectable()
export class BreedingServicesService {
  constructor(
    @Inject(BREEDING_SERVICE_REPOSITORY)
    private readonly repository: IBreedingServiceRepository,
    private readonly evaluation: BreedingEvaluationService,
    private readonly getAnimal: GetAnimalUseCase,
  ) {}

  async get(id: string): Promise<BreedingService> {
    const service = await this.repository.findById(id);
    if (!service) {
      throw new NotFoundException(`No se encontró la monta con ID "${id}"`);
    }
    return service;
  }

  list(
    query: ListBreedingServicesQueryDto,
  ): Promise<Paginated<BreedingService>> {
    const { page, limit, ...filters } = query;
    return this.repository.findPaginated(filters, { page, limit });
  }

  /**
   * Bloquea la monta si la pareja no es válida, si la hembra tiene otra monta
   * abierta o si están emparentados. El parentesco se puede autorizar con el
   * permiso reproduction:override-kinship y una justificación.
   */
  async create(
    actor: Actor,
    dto: CreateBreedingServiceDto,
  ): Promise<ServiceResult> {
    const evaluation = await this.evaluation.evaluate(dto);
    const invalid = evaluation.blocks.find((b) => b.code === INVALID_PAIR);
    if (invalid) throw new BadRequestException(invalid.message);
    const open = evaluation.blocks.find((b) => b.code === OPEN_SERVICE);
    if (open) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: OPEN_SERVICE,
        message: open.message,
        serviceId: open.serviceId,
      });
    }

    const override = this.kinshipOverride(actor, dto, evaluation);
    const service = BreedingService.create({
      dam: evaluation.dam,
      sire: evaluation.sire,
      type: dto.type,
      serviceDate: dto.serviceDate,
      exitDate: dto.exitDate ?? null,
      strawCode: dto.strawCode ?? null,
      notes: dto.notes ?? null,
      inbreedingCoefficient: evaluation.kinship.inbreedingCoefficient,
      kinshipOverride: override,
      expectedOffspringCategory: evaluation.expectedOffspringCategory,
      createdBy: actor.id,
      now: new Date(),
    });
    await this.repository.save(service, actor.id);
    // Se relee para devolver quién la registró.
    const saved = (await this.repository.findById(service.getId())) ?? service;
    const warnings = [...evaluation.warnings];
    if (override) {
      warnings.unshift(
        `Monta autorizada pese al parentesco (${evaluation.kinship.relationship}).`,
      );
    }
    return { service: saved, warnings };
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateBreedingServiceDto,
  ): Promise<BreedingService> {
    const service = await this.get(id);
    const dam = await this.getAnimal.execute(service.getDam().id);
    const sire = await this.getAnimal.execute(service.getSire().id);
    service.update(dto, dam, sire, new Date());
    service.markUpdatedBy(actorId);
    await this.repository.save(service, actorId);
    return service;
  }

  async delete(actorId: string, id: string): Promise<void> {
    const service = await this.get(id);
    if (service.getStatus() === ServiceStatus.BIRTHED) {
      throw new ConflictException(
        'No se puede eliminar la monta: tiene un parto registrado y las crías dependen de ella',
      );
    }
    await this.repository.softDelete(id, actorId);
  }

  async addCheck(
    actorId: string,
    id: string,
    dto: CreatePregnancyCheckDto,
  ): Promise<{ service: BreedingService; check: PregnancyCheck }> {
    const service = await this.get(id);
    const check = service.addCheck(dto, actorId, new Date());
    await this.assertSingleOpen(service);
    service.markUpdatedBy(actorId);
    await this.repository.save(service, actorId);
    return { service, check };
  }

  async removeCheck(
    actorId: string,
    id: string,
    checkId: string,
  ): Promise<BreedingService> {
    const service = await this.get(id);
    service.removeCheck(checkId);
    await this.assertSingleOpen(service);
    service.markUpdatedBy(actorId);
    await this.repository.save(service, actorId);
    return service;
  }

  async recordAbortion(
    actorId: string,
    id: string,
    dto: RecordAbortionDto,
  ): Promise<BreedingService> {
    const service = await this.get(id);
    service.recordAbortion(
      { date: dto.date, cause: dto.cause ?? null },
      new Date(),
    );
    service.markUpdatedBy(actorId);
    await this.repository.save(service, actorId);
    return service;
  }

  async cancelAbortion(actorId: string, id: string): Promise<BreedingService> {
    const service = await this.get(id);
    service.cancelAbortion();
    await this.assertSingleOpen(service);
    service.markUpdatedBy(actorId);
    await this.repository.save(service, actorId);
    return service;
  }

  private kinshipOverride(
    actor: Actor,
    dto: CreateBreedingServiceDto,
    evaluation: BreedingEvaluation,
  ): KinshipOverride | null {
    const block = evaluation.blocks.find((b) => b.code === KINSHIP_CONFLICT);
    if (!block) return null;
    if (!dto.overrideKinship) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: KINSHIP_CONFLICT,
        message: `No se puede registrar la monta: ${block.message}`,
        kinship: {
          relationship: evaluation.kinship.relationship,
          inbreedingCoefficient: evaluation.kinship.inbreedingCoefficient,
          commonAncestors: evaluation.kinship.commonAncestors,
        },
        canOverride: actor.permissions.includes(
          PERMISSIONS.REPRODUCTION_OVERRIDE_KINSHIP,
        ),
      });
    }
    if (
      !actor.permissions.includes(PERMISSIONS.REPRODUCTION_OVERRIDE_KINSHIP)
    ) {
      throw new ForbiddenException(
        `Autorizar una monta entre animales emparentados requiere el permiso ${PERMISSIONS.REPRODUCTION_OVERRIDE_KINSHIP}`,
      );
    }
    return {
      reason: dto.overrideReason!.trim(),
      authorizedBy: actor.id,
      authorizedAt: new Date(),
    };
  }

  /** Al reabrir una monta (quitar un diagnóstico o un aborto), no puede haber otra abierta. */
  private async assertSingleOpen(service: BreedingService): Promise<void> {
    if (!OPEN_SERVICE_STATUSES.includes(service.getStatus())) return;
    const other = await this.repository.findOpenForDam(
      service.getDam().id,
      service.getId(),
    );
    if (other) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: OPEN_SERVICE,
        message: `La hembra ${describeAnimal(service.getDam())} ya tiene otra monta abierta (${other.getServiceDate()}): esta monta no puede quedar abierta también.`,
        serviceId: other.getId(),
      });
    }
  }
}
