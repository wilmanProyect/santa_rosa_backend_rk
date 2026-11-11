import { AnimalOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal.orm-entity';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { AuditInfo } from '@shared/domain/audit-info';
import { BreedingAnimalRef } from '../../../domain/models/breeding-animal-ref';
import {
  BreedingService,
  PregnancyCheck,
} from '../../../domain/models/breeding-service.model';
import { Birth } from '../../../domain/models/birth.model';
import { BreedingServiceOrmEntity } from '../entities/breeding-service.orm-entity';
import { PregnancyCheckOrmEntity } from '../entities/pregnancy-check.orm-entity';
import { BirthOrmEntity } from '../entities/birth.orm-entity';
import { BirthOffspringOrmEntity } from '../entities/birth-offspring.orm-entity';

const ref = (a: AnimalOrmEntity): BreedingAnimalRef => ({
  id: a.id,
  earTag: a.earTag,
  name: a.name,
  isExternal: a.isExternal,
  geneticCategory: a.geneticCategory,
});

const reference = (id: string) => ({ id }) as AnimalOrmEntity;

const audit = (e: AuditableOrmEntity): AuditInfo => ({
  createdAt: e.createdAt,
  createdBy: e.createdBy,
  updatedAt: e.updatedAt,
  updatedBy: e.updatedBy,
});

export class BreedingServiceMapper {
  /** Requiere las relaciones dam, sire y checks cargadas. */
  static toDomain(e: BreedingServiceOrmEntity): BreedingService {
    return new BreedingService({
      id: e.id,
      dam: ref(e.dam),
      sire: ref(e.sire),
      species: e.species,
      type: e.type,
      serviceDate: e.serviceDate,
      strawCode: e.strawCode,
      performedBy: e.performedBy,
      expectedBirthDate: e.expectedBirthDate,
      status: e.status,
      inbreedingCoefficient: e.inbreedingCoefficient,
      kinshipOverride:
        e.kinshipOverrideReason && e.kinshipOverrideBy && e.kinshipOverrideAt
          ? {
              reason: e.kinshipOverrideReason,
              authorizedBy: e.kinshipOverrideBy,
              authorizedAt: e.kinshipOverrideAt,
            }
          : null,
      expectedOffspringCategory: e.expectedOffspringCategory,
      abortion: e.abortionDate
        ? { date: e.abortionDate, cause: e.abortionCause }
        : null,
      checks: (e.checks ?? [])
        .filter((c) => !c.deletedAt)
        .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt))
        .map((c): PregnancyCheck => ({
          id: c.id,
          checkedAt: c.checkedAt,
          method: c.method,
          result: c.result,
          fetusCount: c.fetusCount,
          notes: c.notes,
          audit: audit(c),
        })),
      notes: e.notes,
      audit: audit(e),
    });
  }

  static toOrm(s: BreedingService): BreedingServiceOrmEntity {
    const a = s.getAudit();
    const override = s.getKinshipOverride();
    const abortion = s.getAbortion();
    const e = new BreedingServiceOrmEntity();
    e.id = s.getId();
    e.dam = reference(s.getDam().id);
    e.sire = reference(s.getSire().id);
    e.species = s.getSpecies();
    e.type = s.getType();
    e.serviceDate = s.getServiceDate();
    e.strawCode = s.getStrawCode();
    e.performedBy = s.getPerformedBy();
    e.expectedBirthDate = s.getExpectedBirthDate();
    e.status = s.getStatus();
    e.inbreedingCoefficient = s.getInbreedingCoefficient();
    e.kinshipOverrideReason = override?.reason ?? null;
    e.kinshipOverrideBy = override?.authorizedBy ?? null;
    e.kinshipOverrideAt = override?.authorizedAt ?? null;
    e.expectedOffspringCategory = s.getExpectedOffspringCategory();
    e.abortionDate = abortion?.date ?? null;
    e.abortionCause = abortion?.cause ?? null;
    e.notes = s.getNotes();
    e.createdBy = a.createdBy;
    e.updatedBy = a.updatedBy;
    e.checks = s.getChecks().map((c) => {
      const check = new PregnancyCheckOrmEntity();
      check.id = c.id;
      check.service = { id: e.id } as BreedingServiceOrmEntity;
      check.checkedAt = c.checkedAt;
      check.method = c.method;
      check.result = c.result;
      check.fetusCount = c.fetusCount;
      check.notes = c.notes;
      check.createdBy = c.audit.createdBy;
      check.updatedBy = c.audit.updatedBy;
      return check;
    });
    return e;
  }
}

export class BirthMapper {
  /** Requiere las relaciones service, dam, sire y offspring.animal cargadas. */
  static toDomain(e: BirthOrmEntity): Birth {
    return new Birth({
      id: e.id,
      serviceId: e.service?.id ?? null,
      dam: ref(e.dam),
      sire: e.sire ? ref(e.sire) : null,
      species: e.species,
      birthDate: e.birthDate,
      assistance: e.assistance,
      isHistorical: e.isHistorical,
      offspring: [...(e.offspring ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({
          id: o.id,
          position: o.position,
          sex: o.sex,
          bornAlive: o.bornAlive,
          birthWeightKg: o.birthWeightKg,
          animal: o.animal
            ? { id: o.animal.id, earTag: o.animal.earTag, name: o.animal.name }
            : null,
        })),
      notes: e.notes,
      audit: audit(e),
    });
  }

  static toOrm(b: Birth): BirthOrmEntity {
    const a = b.getAudit();
    const e = new BirthOrmEntity();
    e.id = b.getId();
    const serviceId = b.getServiceId();
    e.service = serviceId
      ? ({ id: serviceId } as BreedingServiceOrmEntity)
      : null;
    e.dam = reference(b.getDam().id);
    const sire = b.getSire();
    e.sire = sire ? reference(sire.id) : null;
    e.species = b.getSpecies();
    e.birthDate = b.getBirthDate();
    e.assistance = b.getAssistance();
    e.isHistorical = b.getIsHistorical();
    e.notes = b.getNotes();
    e.createdBy = a.createdBy;
    e.updatedBy = a.updatedBy;
    e.offspring = b.getOffspring().map((o) => {
      const child = new BirthOffspringOrmEntity();
      child.id = o.id;
      child.birth = { id: e.id } as BirthOrmEntity;
      child.position = o.position;
      child.sex = o.sex;
      child.bornAlive = o.bornAlive;
      child.birthWeightKg = o.birthWeightKg;
      child.animal = o.animal ? reference(o.animal.id) : null;
      return child;
    });
    return e;
  }
}
