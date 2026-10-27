import { Breed } from '../../domain/models/breed.model';

export class BreedPresenter {
  static toSummary(breed: Breed) {
    return { id: breed.getId(), name: breed.getName() };
  }

  static toResponse(breed: Breed) {
    const audit = breed.getAudit();
    return {
      id: breed.getId(),
      species: breed.getSpecies(),
      name: breed.getName(),
      isActive: breed.getIsActive(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
