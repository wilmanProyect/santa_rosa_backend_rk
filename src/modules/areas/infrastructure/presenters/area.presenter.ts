import { Area } from '../../domain/models/area.model';

export class AreaPresenter {
  static toSummary(area: Area | null) {
    if (!area) return null;
    return { id: area.getId(), name: area.getName() };
  }

  static toResponse(area: Area) {
    const audit = area.getAudit();
    return {
      id: area.getId(),
      name: area.getName(),
      description: area.getDescription(),
      isActive: area.getIsActive(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
