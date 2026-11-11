import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Paginated } from '@shared/domain/paginated';
import { EntryOrigin } from '@modules/animals/domain/enums/animal.enums';
import { Animal } from '@modules/animals/domain/models/animal.model';
import {
  AnimalWeighing,
  WeighingType,
} from '@modules/animals/domain/models/animal-weighing.model';
import {
  GeneticCategoryChange,
  GeneticCategoryChangeKind,
  newGeneticCategoryChange,
} from '@modules/animals/domain/models/genetic-category-change';
import { addDays } from '@modules/animals/domain/models/animal-event-date';
import { GetAnimalUseCase } from '@modules/animals/application/use-cases/animals/get-animal.use-case';
import { GetBreedUseCase } from '@modules/animals/application/use-cases/breeds/get-breed.use-case';
import { GetAnimalColorUseCase } from '@modules/animals/application/use-cases/colors/get-animal-color.use-case';
import { AnimalIdentifierService } from '@modules/animals/application/services/animal-identifier.service';
import {
  BIRTH_REPOSITORY,
  BREEDING_SERVICE_REPOSITORY,
} from '../../domain/repositories/reproduction.repository.interface';
import type {
  IBirthRepository,
  IBreedingServiceRepository,
} from '../../domain/repositories/reproduction.repository.interface';
import {
  MIN_DAYS_BETWEEN_BIRTHS,
  ServiceStatus,
} from '../../domain/enums/reproduction.enums';
import { Birth } from '../../domain/models/birth.model';
import { BreedingService } from '../../domain/models/breeding-service.model';
import { describeAnimal } from '../../domain/models/breeding-animal-ref';
import { expectedOffspringCategory } from '../../domain/genetic-category-inheritance';
import {
  ListBirthsQueryDto,
  RegisterBirthDto,
  RegisterUnplannedBirthDto,
  UpdateBirthDto,
} from '../dtos/birth.dto';
import {
  BreedingEvaluationService,
  OPEN_SERVICE,
} from '../services/breeding-evaluation.service';

export const BIRTH_TOO_CLOSE = 'BIRTH_TOO_CLOSE';

export interface BirthResult {
  birth: Birth;
  /** Animales creados para las crías vivas. */
  animals: Animal[];
  warnings: string[];
}

@Injectable()
export class BirthsService {
  constructor(
    @Inject(BIRTH_REPOSITORY) private readonly births: IBirthRepository,
    @Inject(BREEDING_SERVICE_REPOSITORY)
    private readonly services: IBreedingServiceRepository,
    private readonly getAnimal: GetAnimalUseCase,
    private readonly getBreed: GetBreedUseCase,
    private readonly getColor: GetAnimalColorUseCase,
    private readonly identifiers: AnimalIdentifierService,
    private readonly evaluation: BreedingEvaluationService,
  ) {}

  async get(id: string): Promise<Birth> {
    const birth = await this.births.findById(id);
    if (!birth)
      throw new NotFoundException(`No se encontró el parto con ID "${id}"`);
    return birth;
  }

  list(query: ListBirthsQueryDto): Promise<Paginated<Birth>> {
    const { page, limit, ...filters } = query;
    return this.births.findPaginated(filters, { page, limit });
  }

  async registerForService(
    actorId: string,
    serviceId: string,
    dto: RegisterBirthDto,
  ): Promise<BirthResult> {
    const service = await this.services.findById(serviceId);
    if (!service) {
      throw new NotFoundException(
        `No se encontró la monta con ID "${serviceId}"`,
      );
    }
    if (service.getStatus() === ServiceStatus.BIRTHED) {
      const existing = await this.births.findByService(serviceId);
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        message: 'La monta ya tiene un parto registrado',
        birthId: existing?.getId() ?? null,
      });
    }
    const dam = await this.getAnimal.execute(service.getDam().id);
    const sire = await this.getAnimal.execute(service.getSire().id);
    return this.register(actorId, dto, dam, sire, service);
  }

  /** Parto sin monta registrada. Si la hembra tiene una monta abierta, se exige usarla. */
  async registerUnplanned(
    actorId: string,
    dto: RegisterUnplannedBirthDto,
  ): Promise<BirthResult> {
    const dam = await this.getAnimal.execute(dto.damId);
    const open = await this.services.findOpenForDam(dam.getId(), null);
    if (open) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: OPEN_SERVICE,
        message: `La hembra tiene una monta abierta del ${open.getServiceDate()} con ${describeAnimal(open.getSire())}: registre el parto en esa monta.`,
        serviceId: open.getId(),
      });
    }
    const sire = dto.sireId ? await this.getAnimal.execute(dto.sireId) : null;
    return this.register(actorId, dto, dam, sire, null);
  }

  async update(
    actorId: string,
    id: string,
    dto: UpdateBirthDto,
  ): Promise<Birth> {
    const birth = await this.get(id);
    birth.update(dto);
    birth.markUpdatedBy(actorId);
    await this.births.save(birth);
    return birth;
  }

  private async register(
    actorId: string,
    dto: RegisterBirthDto,
    dam: Animal,
    sire: Animal | null,
    service: BreedingService | null,
  ): Promise<BirthResult> {
    const now = new Date();
    const birth = Birth.register({
      dam,
      sire,
      service,
      birthDate: dto.birthDate,
      assistance: dto.assistance ?? null,
      offspring: dto.offspring.map((o) => ({
        sex: o.sex ?? null,
        bornAlive: o.bornAlive,
        birthWeightKg: o.birthWeightKg ?? null,
      })),
      notes: dto.notes ?? null,
      createdBy: actorId,
      now,
    });
    service?.markBirthed(dto.birthDate);
    await this.assertBirthInterval(dam, dto.birthDate);

    const earTags = dto.offspring
      .filter((o) => o.bornAlive)
      .map((o) => o.earTag!.trim().toUpperCase());
    if (new Set(earTags).size !== earTags.length) {
      throw new BadRequestException('Hay crías con el mismo arete en el parto');
    }

    const warnings = birth.warnings(service);
    if (!service && sire) {
      const kinship = await this.evaluation.kinship(dam.getId(), sire.getId());
      if (kinship.related) {
        warnings.push(
          `Los padres están emparentados (${kinship.relationship}): consanguinidad de las crías ${(kinship.inbreedingCoefficient * 100).toFixed(2)} %.`,
        );
      }
    }

    const category = expectedOffspringCategory(
      dam.getGeneticCategory(),
      sire?.getGeneticCategory() ?? null,
    );
    if (!category && sire) {
      warnings.push(
        'No se calculó la categoría genética de las crías (falta la de un padre o la regla no la define): cárguela a mano.',
      );
    }

    const animals: Animal[] = [];
    const weighings: AnimalWeighing[] = [];
    const categoryChanges: GeneticCategoryChange[] = [];
    for (const [index, o] of dto.offspring.entries()) {
      if (!o.bornAlive) continue;
      const breed = o.breedId
        ? await this.getBreed.executeActive(o.breedId)
        : dam.getBreed();
      const color = o.colorId
        ? await this.getColor.executeActive(o.colorId)
        : null;
      const animal = Animal.create({
        isExternal: false,
        earTag: o.earTag!,
        name: o.name ?? null,
        species: dam.getSpecies(),
        breed,
        sex: o.sex!,
        color,
        geneticCategory: category,
        geneticCategoryConfirmed: false,
        dam: dam.toParent(),
        sire: sire?.toParent() ?? null,
        birthDate: dto.birthDate,
        entryOrigin: EntryOrigin.BORN_ON_FARM,
        notes: o.notes ?? null,
        createdBy: actorId,
        now,
      });
      await this.identifiers.assertAvailable(animal);
      birth.linkOffspringAnimal(index + 1, animal);
      animals.push(animal);

      if (o.birthWeightKg) {
        weighings.push(
          AnimalWeighing.create({
            animal,
            data: {
              weighedAt: dto.birthDate,
              weightKg: o.birthWeightKg,
              type: WeighingType.BIRTH,
            },
            createdBy: actorId,
            now,
          }),
        );
      }
      if (category) {
        categoryChanges.push(
          newGeneticCategoryChange({
            animalId: animal.getId(),
            fromCategory: null,
            toCategory: category,
            kind: GeneticCategoryChangeKind.EXPECTED_AT_BIRTH,
            changedOn: dto.birthDate,
            notes: `Madre ${dam.getGeneticCategory()} × padre ${sire?.getGeneticCategory()}`,
            createdBy: actorId,
          }),
        );
      }
    }

    await this.births.register({
      birth,
      service,
      animals,
      weighings,
      categoryChanges,
      actorId,
    });
    return { birth, animals, warnings };
  }

  /** Dos partos de la misma madre con menos de 140 días: uno de los dos es un error. */
  private async assertBirthInterval(
    dam: Animal,
    birthDate: string,
  ): Promise<void> {
    const near = await this.births.findDamBirthsBetween(
      dam.getId(),
      addDays(birthDate, -(MIN_DAYS_BETWEEN_BIRTHS - 1)),
      addDays(birthDate, MIN_DAYS_BETWEEN_BIRTHS - 1),
    );
    if (near.length > 0) {
      throw new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        code: BIRTH_TOO_CLOSE,
        message: `La hembra ${describeAnimal(near[0].getDam())} ya tiene un parto registrado el ${near[0].getBirthDate()}: dos partos no pueden estar a menos de ${MIN_DAYS_BETWEEN_BIRTHS} días.`,
        birthId: near[0].getId(),
      });
    }
  }
}
