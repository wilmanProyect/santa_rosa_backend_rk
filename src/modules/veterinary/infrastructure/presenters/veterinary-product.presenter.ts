import { VeterinaryProduct } from '../../domain/models/veterinary-product.model';

export class VeterinaryProductPresenter {
  static toSummary(product: VeterinaryProduct | null) {
    if (!product) return null;
    return {
      id: product.getId(),
      name: product.getName(),
      category: product.getCategory(),
    };
  }

  static toResponse(product: VeterinaryProduct) {
    const audit = product.getAudit();
    return {
      id: product.getId(),
      name: product.getName(),
      category: product.getCategory(),
      activeIngredient: product.getActiveIngredient(),
      concentration: product.getConcentration(),
      manufacturer: product.getManufacturer(),
      presentation: product.getPresentation(),
      doseUnit: product.getDoseUnit(),
      defaultRoute: product.getDefaultRoute(),
      dosageInstructions: product.getDosageInstructions(),
      forSheep: product.getForSheep(),
      forGoats: product.getForGoats(),
      meatWithdrawalDays: product.getMeatWithdrawalDays(),
      milkWithdrawalDays: product.getMilkWithdrawalDays(),
      requiresPrescription: product.getRequiresPrescription(),
      requiresRefrigeration: product.getRequiresRefrigeration(),
      notes: product.getNotes(),
      isActive: product.getIsActive(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
