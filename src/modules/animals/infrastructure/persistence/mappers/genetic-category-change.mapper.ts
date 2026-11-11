import { GeneticCategoryChange } from '../../../domain/models/genetic-category-change';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';
import { GeneticCategoryChangeOrmEntity } from '../entities/genetic-category-change.orm-entity';

export class GeneticCategoryChangeMapper {
  /** Requiere la relación animal cargada (solo se usa su id). */
  static toDomain(e: GeneticCategoryChangeOrmEntity): GeneticCategoryChange {
    return {
      id: e.id,
      animalId: e.animal.id,
      fromCategory: e.fromCategory,
      toCategory: e.toCategory,
      kind: e.kind,
      changedOn: e.changedOn,
      absidCertificateCode: e.absidCertificateCode,
      notes: e.notes,
      createdBy: e.createdBy,
      createdAt: e.createdAt,
    };
  }

  static toOrm(change: GeneticCategoryChange): GeneticCategoryChangeOrmEntity {
    const e = new GeneticCategoryChangeOrmEntity();
    e.id = change.id;
    e.animal = { id: change.animalId } as AnimalOrmEntity;
    e.fromCategory = change.fromCategory;
    e.toCategory = change.toCategory;
    e.kind = change.kind;
    e.changedOn = change.changedOn;
    e.absidCertificateCode = change.absidCertificateCode;
    e.notes = change.notes;
    e.createdBy = change.createdBy;
    return e;
  }
}
