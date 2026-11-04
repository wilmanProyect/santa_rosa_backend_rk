import { HealthRecord } from '../../domain/models/health-record.model';

export class HealthRecordPresenter {
  static toResponse(record: HealthRecord) {
    const audit = record.getAudit();
    const product = record.getProduct();
    return {
      id: record.getId(),
      animalId: record.getAnimalId(),
      category: record.getCategory(),
      type: record.getType(),
      appliedAt: record.getAppliedAt(),
      isDateEstimated: record.getIsDateEstimated(),
      product: product ? { id: product.id, name: product.name } : null,
      productBatch: record.getProductBatch(),
      doseQuantity: record.getDoseQuantity(),
      doseUnit: record.getDoseUnit(),
      route: record.getRoute(),
      targetCondition: record.getTargetCondition(),
      appliedBy: record.getAppliedBy(),
      location: record.getLocation(),
      meatWithdrawalDays: product?.meatWithdrawalDays ?? 0,
      meatWithdrawalEndsOn: record.getMeatWithdrawalEndsOn(),
      milkWithdrawalEndsOn: record.getMilkWithdrawalEndsOn(),
      nextDoseAt: record.getNextDoseAt(),
      cost: record.getCost(),
      notes: record.getNotes(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
