import { VeterinaryProductOrmEntity } from '@modules/veterinary/infrastructure/persistence/entities/veterinary-product.orm-entity';
import { HealthRecord } from '../../../domain/models/health-record.model';
import { HealthRecordOrmEntity } from '../entities/health-record.orm-entity';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';

export class HealthRecordMapper {
  /** Requiere las relaciones animal y product cargadas. */
  static toDomain(e: HealthRecordOrmEntity): HealthRecord {
    return new HealthRecord({
      id: e.id,
      animalId: e.animal?.id ?? null,
      type: e.type,
      appliedAt: e.appliedAt,
      isDateEstimated: e.isDateEstimated,
      product: e.product
        ? {
            id: e.product.id,
            name: e.product.name,
            meatWithdrawalDays: e.meatWithdrawalDays,
            milkWithdrawalDays: e.milkWithdrawalDays,
          }
        : null,
      productBatch: e.productBatch,
      doseQuantity: e.doseQuantity,
      doseUnit: e.doseUnit,
      route: e.route,
      targetCondition: e.targetCondition,
      appliedBy: e.appliedBy,
      location: e.location,
      nextDoseAt: e.nextDoseAt,
      cost: e.cost,
      notes: e.notes,
      audit: {
        createdAt: e.createdAt,
        createdBy: e.createdBy,
        updatedAt: e.updatedAt,
        updatedBy: e.updatedBy,
      },
    });
  }

  static toOrm(r: HealthRecord): HealthRecordOrmEntity {
    const audit = r.getAudit();
    const product = r.getProduct();
    const e = new HealthRecordOrmEntity();
    e.id = r.getId();
    e.animal = r.getAnimalId()
      ? ({ id: r.getAnimalId() } as AnimalOrmEntity)
      : null;
    e.type = r.getType();
    e.appliedAt = r.getAppliedAt();
    e.isDateEstimated = r.getIsDateEstimated();
    e.product = product
      ? ({ id: product.id } as VeterinaryProductOrmEntity)
      : null;
    e.meatWithdrawalDays = product?.meatWithdrawalDays ?? 0;
    e.milkWithdrawalDays = product?.milkWithdrawalDays ?? null;
    e.productBatch = r.getProductBatch();
    e.doseQuantity = r.getDoseQuantity();
    e.doseUnit = r.getDoseUnit();
    e.route = r.getRoute();
    e.targetCondition = r.getTargetCondition();
    e.appliedBy = r.getAppliedBy();
    e.location = r.getLocation();
    e.nextDoseAt = r.getNextDoseAt();
    e.cost = r.getCost();
    e.notes = r.getNotes();
    e.createdBy = audit.createdBy;
    e.updatedBy = audit.updatedBy;
    return e;
  }
}
