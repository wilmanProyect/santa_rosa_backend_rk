import { StoredFile } from '@shared/domain/stored-file';
import { Animal } from '../../../domain/models/animal.model';
import { AnimalParent } from '../../../domain/models/animal-parent';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';
import { BreedMapper } from './breed.mapper';
import { AnimalColorMapper } from './animal-color.mapper';

export class AnimalMapper {
  /** Requiere las relaciones breed, color, dam y sire cargadas. */
  static toDomain(ormEntity: AnimalOrmEntity): Animal {
    return new Animal({
      id: ormEntity.id,
      isExternal: ormEntity.isExternal,
      earTag: ormEntity.earTag,
      name: ormEntity.name,
      species: ormEntity.species,
      breed: BreedMapper.toDomain(ormEntity.breed),
      sex: ormEntity.sex,
      color: ormEntity.color
        ? AnimalColorMapper.toDomain(ormEntity.color)
        : null,
      geneticCategory: ormEntity.geneticCategory,
      absidRegistry: ormEntity.absidRegistry,
      absidCertificateCode: ormEntity.absidCertificateCode,
      externalRegistry: ormEntity.externalRegistry,
      identifierException: ormEntity.identifierException,
      identifierExceptionReason: ormEntity.identifierExceptionReason,
      certificateFile: this.toStoredFile(ormEntity),
      dam: this.toParent(ormEntity.dam),
      sire: this.toParent(ormEntity.sire),
      birthDate: ormEntity.birthDate,
      birthWeightKg: ormEntity.birthWeightKg,
      weaningDate: ormEntity.weaningDate,
      weaningWeightKg: ormEntity.weaningWeightKg,
      entryOrigin: ormEntity.entryOrigin,
      entryDate: ormEntity.entryDate,
      sourceFarm: ormEntity.sourceFarm,
      status: ormEntity.status,
      statusDate: ormEntity.statusDate,
      statusReason: ormEntity.statusReason,
      notes: ormEntity.notes,
      audit: {
        createdAt: ormEntity.createdAt,
        createdBy: ormEntity.createdBy,
        updatedAt: ormEntity.updatedAt,
        updatedBy: ormEntity.updatedBy,
      },
    });
  }

  static toOrm(domainModel: Animal): AnimalOrmEntity {
    const audit = domainModel.getAudit();
    const file = domainModel.getCertificateFile();
    const ormEntity = new AnimalOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.isExternal = domainModel.getIsExternal();
    ormEntity.earTag = domainModel.getEarTag();
    ormEntity.name = domainModel.getName();
    ormEntity.species = domainModel.getSpecies();
    ormEntity.breed = BreedMapper.toReference(domainModel.getBreed());
    ormEntity.sex = domainModel.getSex();
    ormEntity.color = AnimalColorMapper.toReference(domainModel.getColor());
    ormEntity.geneticCategory = domainModel.getGeneticCategory();
    ormEntity.absidRegistry = domainModel.getAbsidRegistry();
    ormEntity.absidCertificateCode = domainModel.getAbsidCertificateCode();
    ormEntity.externalRegistry = domainModel.getExternalRegistry();
    ormEntity.identifierException = domainModel.getIdentifierException();
    ormEntity.identifierExceptionReason =
      domainModel.getIdentifierExceptionReason();
    ormEntity.certificateFileKey = file?.key ?? null;
    ormEntity.certificateFileName = file?.originalName ?? null;
    ormEntity.certificateFileMimeType = file?.mimeType ?? null;
    ormEntity.certificateFileSize = file?.sizeBytes ?? null;
    ormEntity.certificateFileUploadedAt = file?.uploadedAt ?? null;
    ormEntity.dam = this.toReference(domainModel.getDam());
    ormEntity.sire = this.toReference(domainModel.getSire());
    ormEntity.birthDate = domainModel.getBirthDate();
    ormEntity.birthWeightKg = domainModel.getBirthWeightKg();
    ormEntity.weaningDate = domainModel.getWeaningDate();
    ormEntity.weaningWeightKg = domainModel.getWeaningWeightKg();
    ormEntity.entryOrigin = domainModel.getEntryOrigin();
    ormEntity.entryDate = domainModel.getEntryDate();
    ormEntity.sourceFarm = domainModel.getSourceFarm();
    ormEntity.status = domainModel.getStatus();
    ormEntity.statusDate = domainModel.getStatusDate();
    ormEntity.statusReason = domainModel.getStatusReason();
    ormEntity.notes = domainModel.getNotes();
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }

  private static toStoredFile(ormEntity: AnimalOrmEntity): StoredFile | null {
    // El CHECK de la BD garantiza que las cinco columnas estén todas o ninguna.
    if (
      !ormEntity.certificateFileKey ||
      !ormEntity.certificateFileName ||
      !ormEntity.certificateFileMimeType ||
      ormEntity.certificateFileSize === null ||
      !ormEntity.certificateFileUploadedAt
    ) {
      return null;
    }
    return {
      key: ormEntity.certificateFileKey,
      originalName: ormEntity.certificateFileName,
      mimeType: ormEntity.certificateFileMimeType,
      sizeBytes: ormEntity.certificateFileSize,
      uploadedAt: ormEntity.certificateFileUploadedAt,
    };
  }

  private static toParent(
    ormEntity: AnimalOrmEntity | null,
  ): AnimalParent | null {
    if (!ormEntity) return null;
    return {
      id: ormEntity.id,
      earTag: ormEntity.earTag,
      name: ormEntity.name,
      species: ormEntity.species,
      sex: ormEntity.sex,
      birthDate: ormEntity.birthDate,
      isExternal: ormEntity.isExternal,
    };
  }

  private static toReference(
    parent: AnimalParent | null,
  ): AnimalOrmEntity | null {
    if (!parent) return null;
    const ormEntity = new AnimalOrmEntity();
    ormEntity.id = parent.id;
    return ormEntity;
  }
}
