import { Area } from '../../../domain/models/area.model';
import { AreaOrmEntity } from '../entities/area.orm-entity';

export class AreaMapper {
  static toDomain(ormEntity: AreaOrmEntity): Area {
    return new Area({
      id: ormEntity.id,
      name: ormEntity.name,
      description: ormEntity.description || '',
      isActive: ormEntity.isActive,
      audit: {
        createdAt: ormEntity.createdAt,
        createdBy: ormEntity.createdBy,
        updatedAt: ormEntity.updatedAt,
        updatedBy: ormEntity.updatedBy,
      },
    });
  }

  static toOrm(domainModel: Area): AreaOrmEntity {
    const audit = domainModel.getAudit();
    const ormEntity = new AreaOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.name = domainModel.getName();
    ormEntity.description = domainModel.getDescription();
    ormEntity.isActive = domainModel.getIsActive();
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }

  /** Referencia mínima (solo id) para guardar relaciones sin tocar el área. */
  static toReference(domainModel: Area | null): AreaOrmEntity | null {
    if (!domainModel) return null;
    const ormEntity = new AreaOrmEntity();
    ormEntity.id = domainModel.getId();
    return ormEntity;
  }
}
