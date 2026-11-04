import { Animal } from '../../domain/models/animal.model';
import { AnimalParent } from '../../domain/models/animal-parent';
import { BreedPresenter } from './breed.presenter';
import { AnimalColorPresenter } from './animal-color.presenter';
import type { PrimaryPhotoSummary } from '../../application/services/animal-photo-url.service';
import type { WeightSummary } from '../../domain/repositories/animal-weighing.repository.interface';
import type { AnimalWithdrawal } from '../../application/use-cases/health/health-record.service';

export interface AnimalDetailExtras {
  primaryPhoto?: PrimaryPhotoSummary | null;
  weights?: WeightSummary;
  withdrawal?: AnimalWithdrawal;
}

export class AnimalPresenter {
  /** Versión resumida para listados. */
  static toSummary(
    animal: Animal,
    primaryPhoto: PrimaryPhotoSummary | null = null,
  ) {
    return {
      id: animal.getId(),
      isExternal: animal.getIsExternal(),
      earTag: animal.getEarTag(),
      name: animal.getName(),
      species: animal.getSpecies(),
      breed: BreedPresenter.toSummary(animal.getBreed()),
      sex: animal.getSex(),
      color: AnimalColorPresenter.toSummary(animal.getColor()),
      geneticCategory: animal.getGeneticCategory(),
      absidRegistry: animal.getAbsidRegistry(),
      identifierException: animal.getIdentifierException(),
      birthDate: animal.getBirthDate(),
      status: animal.getStatus(),
      dam: this.parent(animal.getDam()),
      sire: this.parent(animal.getSire()),
      primaryPhoto,
    };
  }

  /** Versión completa, con datos de ingreso, estado, certificado, pesos, retiro y auditoría. */
  static toResponse(animal: Animal, extras: AnimalDetailExtras = {}) {
    const audit = animal.getAudit();
    const primaryPhoto = extras.primaryPhoto ?? null;
    const file = animal.getCertificateFile();
    return {
      ...this.toSummary(animal, primaryPhoto),
      absidCertificateCode: animal.getAbsidCertificateCode(),
      certificateFile: file
        ? {
            fileName: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            uploadedAt: file.uploadedAt,
          }
        : null,
      externalRegistry: animal.getExternalRegistry(),
      identifierExceptionReason: animal.getIdentifierExceptionReason(),
      // Tomados del historial de pesajes.
      birthWeightKg: extras.weights?.birth?.weightKg ?? null,
      weaningDate: extras.weights?.weaning?.weighedAt ?? null,
      weaningWeightKg: extras.weights?.weaning?.weightKg ?? null,
      lastWeighing: extras.weights?.last ?? null,
      // Período de retiro vigente hoy (null si no hay).
      withdrawal:
        extras.withdrawal?.meat || extras.withdrawal?.milk
          ? extras.withdrawal
          : null,
      entryOrigin: animal.getEntryOrigin(),
      entryDate: animal.getEntryDate(),
      sourceFarm: animal.getSourceFarm(),
      statusDate: animal.getStatusDate(),
      statusReason: animal.getStatusReason(),
      notes: animal.getNotes(),
      createdAt: audit.createdAt,
      createdBy: audit.createdBy,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }

  private static parent(parent: AnimalParent | null) {
    if (!parent) return null;
    return {
      id: parent.id,
      earTag: parent.earTag,
      name: parent.name,
      isExternal: parent.isExternal,
    };
  }
}
