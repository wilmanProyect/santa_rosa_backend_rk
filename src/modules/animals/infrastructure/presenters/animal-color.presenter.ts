import { AnimalColor } from '../../domain/models/animal-color.model';

export class AnimalColorPresenter {
  static toSummary(color: AnimalColor | null) {
    if (!color) return null;
    return { id: color.getId(), name: color.getName() };
  }

  static toResponse(color: AnimalColor) {
    const audit = color.getAudit();
    return {
      id: color.getId(),
      name: color.getName(),
      isActive: color.getIsActive(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
