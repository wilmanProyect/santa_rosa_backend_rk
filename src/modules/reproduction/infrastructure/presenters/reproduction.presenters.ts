import { Animal } from '@modules/animals/domain/models/animal.model';
import {
  BreedingService,
  PregnancyCheck,
} from '../../domain/models/breeding-service.model';
import { Birth } from '../../domain/models/birth.model';
import { BreedingAnimalRef } from '../../domain/models/breeding-animal-ref';
import type { BreedingEvaluation } from '../../application/services/breeding-evaluation.service';
import type { AnimalReproduction } from '../../application/use-cases/reproduction-reports.service';

const ref = (a: BreedingAnimalRef) => ({
  id: a.id,
  earTag: a.earTag,
  name: a.name,
  isExternal: a.isExternal,
  geneticCategory: a.geneticCategory,
});

export class PregnancyCheckPresenter {
  static toResponse(c: PregnancyCheck) {
    return {
      id: c.id,
      checkedAt: c.checkedAt,
      method: c.method,
      result: c.result,
      fetusCount: c.fetusCount,
      notes: c.notes,
      createdAt: c.audit.createdAt,
      createdBy: c.audit.createdBy,
    };
  }
}

export class BreedingServicePresenter {
  static toResponse(s: BreedingService, warnings?: string[]) {
    const audit = s.getAudit();
    const override = s.getKinshipOverride();
    return {
      id: s.getId(),
      dam: ref(s.getDam()),
      sire: ref(s.getSire()),
      species: s.getSpecies(),
      type: s.getType(),
      serviceDate: s.getServiceDate(),
      strawCode: s.getStrawCode(),
      performedBy: s.getPerformedBy(),
      expectedBirthDate: s.getExpectedBirthDate(),
      status: s.getStatus(),
      expectedOffspringCategory: s.getExpectedOffspringCategory(),
      expectedFetusCount: s.getExpectedFetusCount(),
      inbreedingCoefficient: s.getInbreedingCoefficient(),
      kinshipOverride: override
        ? {
            reason: override.reason,
            authorizedBy: override.authorizedBy,
            authorizedAt: override.authorizedAt,
          }
        : null,
      abortion: s.getAbortion(),
      checks: s.getChecks().map((c) => PregnancyCheckPresenter.toResponse(c)),
      notes: s.getNotes(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
      ...(warnings ? { warnings } : {}),
    };
  }

  static evaluation(e: BreedingEvaluation) {
    return {
      allowed: e.allowed,
      blocks: e.blocks,
      warnings: e.warnings,
      dam: ref({
        id: e.dam.getId(),
        earTag: e.dam.getEarTag(),
        name: e.dam.getName(),
        isExternal: e.dam.getIsExternal(),
        geneticCategory: e.dam.getGeneticCategory(),
      }),
      sire: ref({
        id: e.sire.getId(),
        earTag: e.sire.getEarTag(),
        name: e.sire.getName(),
        isExternal: e.sire.getIsExternal(),
        geneticCategory: e.sire.getGeneticCategory(),
      }),
      type: e.type,
      serviceDate: e.serviceDate,
      expectedBirthDate: e.expectedBirthDate,
      expectedOffspringCategory: e.expectedOffspringCategory,
      categoryUpgrade: e.categoryUpgrade,
      kinship: {
        related: e.kinship.related,
        relationship: e.kinship.relationship,
        inbreedingCoefficient: e.kinship.inbreedingCoefficient,
        commonAncestors: e.kinship.commonAncestors,
        knownAncestors: e.kinship.knownAncestors,
      },
    };
  }
}

export class BirthPresenter {
  static toResponse(
    b: Birth,
    extras: { warnings?: string[]; animals?: Animal[] } = {},
  ) {
    const audit = b.getAudit();
    return {
      id: b.getId(),
      serviceId: b.getServiceId(),
      dam: ref(b.getDam()),
      sire: (() => {
        const sire = b.getSire();
        return sire ? ref(sire) : null;
      })(),
      species: b.getSpecies(),
      birthDate: b.getBirthDate(),
      assistance: b.getAssistance(),
      litterSize: b.getLitterSize(),
      litterType: b.getLitterType(),
      bornAlive: b.getBornAlive(),
      bornDead: b.getBornDead(),
      isHistorical: b.getIsHistorical(),
      offspring: b.getOffspring().map((o) => ({
        position: o.position,
        sex: o.sex,
        bornAlive: o.bornAlive,
        birthWeightKg: o.birthWeightKg,
        animal: (() => {
          if (!o.animal) return null;
          const created = extras.animals?.find(
            (a) => a.getId() === o.animal!.id,
          );
          return {
            ...o.animal,
            ...(created
              ? {
                  geneticCategory: created.getGeneticCategory(),
                  geneticCategoryConfirmed:
                    created.getGeneticCategoryConfirmed(),
                }
              : {}),
          };
        })(),
      })),
      notes: b.getNotes(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
      ...(extras.warnings ? { warnings: extras.warnings } : {}),
    };
  }
}

export class AnimalReproductionPresenter {
  static toResponse(r: AnimalReproduction) {
    const open = r.summary.openService;
    return {
      summary: {
        ...r.summary,
        openService: open
          ? {
              id: open.getId(),
              status: open.getStatus(),
              serviceDate: open.getServiceDate(),
              expectedBirthDate: open.getExpectedBirthDate(),
              sire: ref(open.getSire()),
            }
          : null,
      },
      services: r.services.map((s) => BreedingServicePresenter.toResponse(s)),
      births: r.births.map((b) => BirthPresenter.toResponse(b)),
    };
  }
}
