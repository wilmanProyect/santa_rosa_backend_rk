import { VeterinaryProduct } from '../../../domain/models/veterinary-product.model';
import { VeterinaryProductOrmEntity } from '../entities/veterinary-product.orm-entity';

export class VeterinaryProductMapper {
  static toDomain(e: VeterinaryProductOrmEntity): VeterinaryProduct {
    return new VeterinaryProduct({
      id: e.id,
      name: e.name,
      category: e.category,
      activeIngredient: e.activeIngredient,
      concentration: e.concentration,
      manufacturer: e.manufacturer,
      presentation: e.presentation,
      doseUnit: e.doseUnit,
      defaultRoute: e.defaultRoute,
      dosageInstructions: e.dosageInstructions,
      forSheep: e.forSheep,
      forGoats: e.forGoats,
      meatWithdrawalDays: e.meatWithdrawalDays,
      milkWithdrawalDays: e.milkWithdrawalDays,
      requiresPrescription: e.requiresPrescription,
      requiresRefrigeration: e.requiresRefrigeration,
      notes: e.notes,
      isActive: e.isActive,
      audit: {
        createdAt: e.createdAt,
        createdBy: e.createdBy,
        updatedAt: e.updatedAt,
        updatedBy: e.updatedBy,
      },
    });
  }

  static toOrm(p: VeterinaryProduct): VeterinaryProductOrmEntity {
    const audit = p.getAudit();
    const e = new VeterinaryProductOrmEntity();
    e.id = p.getId();
    e.name = p.getName();
    e.category = p.getCategory();
    e.activeIngredient = p.getActiveIngredient();
    e.concentration = p.getConcentration();
    e.manufacturer = p.getManufacturer();
    e.presentation = p.getPresentation();
    e.doseUnit = p.getDoseUnit();
    e.defaultRoute = p.getDefaultRoute();
    e.dosageInstructions = p.getDosageInstructions();
    e.forSheep = p.getForSheep();
    e.forGoats = p.getForGoats();
    e.meatWithdrawalDays = p.getMeatWithdrawalDays();
    e.milkWithdrawalDays = p.getMilkWithdrawalDays();
    e.requiresPrescription = p.getRequiresPrescription();
    e.requiresRefrigeration = p.getRequiresRefrigeration();
    e.notes = p.getNotes();
    e.isActive = p.getIsActive();
    e.createdBy = audit.createdBy;
    e.updatedBy = audit.updatedBy;
    return e;
  }

  /** Referencia mínima (solo id) para guardar relaciones. */
  static toReference(
    p: { getId(): string } | null,
  ): VeterinaryProductOrmEntity | null {
    if (!p) return null;
    const e = new VeterinaryProductOrmEntity();
    e.id = p.getId();
    return e;
  }
}
