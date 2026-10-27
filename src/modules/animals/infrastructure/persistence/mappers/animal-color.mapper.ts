import { AnimalColor } from '../../../domain/models/animal-color.model';
import { AnimalColorOrmEntity } from '../entities/animal-color.orm-entity';

export class AnimalColorMapper {
  static toDomain(ormEntity: AnimalColorOrmEntity): AnimalColor {
    return new AnimalColor({
      id: ormEntity.id,
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

  static toOrm(domainModel: AnimalColor): AnimalColorOrmEntity {
    const audit = domainModel.getAudit();
    const ormEntity = new AnimalColorOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.name = domainModel.getName();
    ormEntity.isActive = domainModel.getIsActive();
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }

  /** Referencia mínima (solo id) para guardar la relación sin tocar el color. */
  static toReference(
    domainModel: AnimalColor | null,
  ): AnimalColorOrmEntity | null {
    if (!domainModel) return null;
    const ormEntity = new AnimalColorOrmEntity();
    ormEntity.id = domainModel.getId();
    return ormEntity;
  }
}
