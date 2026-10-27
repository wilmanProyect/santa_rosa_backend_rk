import { Breed } from '../../../domain/models/breed.model';
import { BreedOrmEntity } from '../entities/breed.orm-entity';

export class BreedMapper {
  static toDomain(ormEntity: BreedOrmEntity): Breed {
    return new Breed({
      id: ormEntity.id,
      species: ormEntity.species,
      name: ormEntity.name,
      isActive: ormEntity.isActive,
      audit: {
        createdAt: ormEntity.createdAt,
        createdBy: ormEntity.createdBy,
        updatedAt: ormEntity.updatedAt,
        updatedBy: ormEntity.updatedBy,
      },
    });
  }

  static toOrm(domainModel: Breed): BreedOrmEntity {
    const audit = domainModel.getAudit();
    const ormEntity = new BreedOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.species = domainModel.getSpecies();
    ormEntity.name = domainModel.getName();
    ormEntity.isActive = domainModel.getIsActive();
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }

  /** Referencia para la FK compuesta (breed_id, species). */
  static toReference(domainModel: Breed): BreedOrmEntity {
    const ormEntity = new BreedOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.species = domainModel.getSpecies();
    return ormEntity;
  }
}
