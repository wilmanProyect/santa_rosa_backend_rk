import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@shared/domain/errors/domain.error';
import { toDateOnly } from '@shared/domain/date-only';
import { GeneticCategory } from '@modules/animals/domain/enums/animal.enums';
import { Animal } from '@modules/animals/domain/models/animal.model';
import { addDays } from '@modules/animals/domain/models/animal-event-date';
import { GetAnimalUseCase } from '@modules/animals/application/use-cases/animals/get-animal.use-case';
import {
  BREEDING_SERVICE_REPOSITORY,
  REPRODUCTION_QUERY_REPOSITORY,
} from '../../domain/repositories/reproduction.repository.interface';
import type {
  IBreedingServiceRepository,
  IReproductionQueryRepository,
} from '../../domain/repositories/reproduction.repository.interface';
import {
  GESTATION_DAYS,
  KINSHIP_GENERATIONS,
  ServiceStatus,
  ServiceType,
} from '../../domain/enums/reproduction.enums';
import { assertBreedingPair } from '../../domain/models/breeding-service.model';
import { describeAnimal } from '../../domain/models/breeding-animal-ref';
import {
  expectedOffspringCategory,
  isUpgrade,
} from '../../domain/genetic-category-inheritance';
import { analyzeKinship, KinshipAnalysis } from '../../domain/kinship';

/** Códigos de bloqueo, para que el frontend sepa qué ofrecer. */
export const INVALID_PAIR = 'INVALID_PAIR';
export const OPEN_SERVICE = 'OPEN_SERVICE';
export const KINSHIP_CONFLICT = 'KINSHIP_CONFLICT';

export interface BreedingBlock {
  code: typeof INVALID_PAIR | typeof OPEN_SERVICE | typeof KINSHIP_CONFLICT;
  message: string;
  /** Solo el parentesco se puede autorizar (con permiso y justificación). */
  overridable: boolean;
  /** Monta abierta que bloquea (OPEN_SERVICE). */
  serviceId?: string;
}

export interface BreedingEvaluation {
  dam: Animal;
  sire: Animal;
  type: ServiceType;
  serviceDate: string;
  allowed: boolean;
  blocks: BreedingBlock[];
  warnings: string[];
  kinship: KinshipAnalysis;
  expectedOffspringCategory: GeneticCategory | null;
  /** true si la cría tendría mayor categoría que la madre. */
  categoryUpgrade: boolean;
  expectedBirthDate: string;
}

const STATUS_LABEL: Partial<Record<ServiceStatus, string>> = {
  [ServiceStatus.PENDING]: 'sin diagnóstico',
  [ServiceStatus.PREGNANT]: 'preñada',
};

/**
 * Revisa una pareja antes de registrar la monta: reglas de la pareja, monta
 * abierta de la hembra, parentesco hasta 3 generaciones y categoría esperada
 * de la cría.
 */
@Injectable()
export class BreedingEvaluationService {
  constructor(
    private readonly getAnimal: GetAnimalUseCase,
    @Inject(BREEDING_SERVICE_REPOSITORY)
    private readonly services: IBreedingServiceRepository,
    @Inject(REPRODUCTION_QUERY_REPOSITORY)
    private readonly queries: IReproductionQueryRepository,
  ) {}

  async evaluate(params: {
    damId: string;
    sireId: string;
    type?: ServiceType;
    serviceDate?: string;
  }): Promise<BreedingEvaluation> {
    const dam = await this.getAnimal.execute(params.damId);
    const sire = await this.getAnimal.execute(params.sireId);
    const type = params.type ?? ServiceType.DIRECTED;
    const now = new Date();
    const serviceDate = params.serviceDate ?? toDateOnly(now);
    const blocks: BreedingBlock[] = [];
    const warnings: string[] = [];

    try {
      assertBreedingPair(dam, sire, type, serviceDate, now);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      blocks.push({
        code: INVALID_PAIR,
        message: error.message,
        overridable: false,
      });
    }

    const open = await this.services.findOpenForDam(dam.getId(), null);
    if (open) {
      blocks.push({
        code: OPEN_SERVICE,
        message: `La hembra ya tiene una monta del ${open.getServiceDate()} con ${describeAnimal(open.getSire())} (${STATUS_LABEL[open.getStatus()]}). Registre el diagnóstico, el parto o el aborto de esa monta antes de una nueva.`,
        overridable: false,
        serviceId: open.getId(),
      });
    }

    const kinship = await this.kinship(dam.getId(), sire.getId());
    if (kinship.related) {
      const closest = kinship.commonAncestors[0];
      blocks.push({
        code: KINSHIP_CONFLICT,
        message: `La hembra y el macho están emparentados (${kinship.relationship}): ${closest.description}. Consanguinidad de la cría: ${(kinship.inbreedingCoefficient * 100).toFixed(2)} %.`,
        overridable: true,
      });
    }
    warnings.push(...kinship.warnings);

    const damCategory = dam.getGeneticCategory();
    const sireCategory = sire.getGeneticCategory();
    const expected = expectedOffspringCategory(damCategory, sireCategory);
    if (!expected) {
      warnings.push(
        !damCategory || !sireCategory
          ? `No se puede calcular la categoría de la cría: falta la categoría ${!damCategory ? 'de la hembra' : 'del macho'}. Se cargará a mano.`
          : `La regla de categorías no define ${damCategory} × ${sireCategory}: la categoría de la cría se cargará a mano.`,
      );
    } else if (!isUpgrade(damCategory, expected)) {
      warnings.push(
        `La cría no sube de categoría: queda ${expected}, igual que la madre.`,
      );
    }
    for (const [who, animal] of [
      ['de la hembra', dam],
      ['del macho', sire],
    ] as const) {
      if (
        animal.getGeneticCategory() &&
        !animal.getGeneticCategoryConfirmed()
      ) {
        warnings.push(
          `La categoría ${who} (${animal.getGeneticCategory()}) todavía es la esperada: falta que ABSID la confirme.`,
        );
      }
    }

    return {
      dam,
      sire,
      type,
      serviceDate,
      allowed: blocks.length === 0,
      blocks,
      warnings,
      kinship,
      expectedOffspringCategory: expected,
      categoryUpgrade: isUpgrade(damCategory, expected),
      expectedBirthDate: addDays(serviceDate, GESTATION_DAYS[dam.getSpecies()]),
    };
  }

  async kinship(damId: string, sireId: string): Promise<KinshipAnalysis> {
    const nodes = await this.queries.loadPedigree(
      [damId, sireId],
      KINSHIP_GENERATIONS,
    );
    return analyzeKinship(
      damId,
      sireId,
      new Map(nodes.map((n) => [n.id, n])),
      KINSHIP_GENERATIONS,
    );
  }
}
