import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';
import { AnimalPhotoOrmEntity } from '../entities/animal-photo.orm-entity';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';

export class AnimalPhotoMapper {
  /** Requiere las relaciones animal y uploadedBy cargadas. */
  static toDomain(ormEntity: AnimalPhotoOrmEntity): AnimalPhoto {
    const uploader = ormEntity.uploadedBy;
    return new AnimalPhoto({
      id: ormEntity.id,
      animalId: ormEntity.animal.id,
      file: {
        objectKey: ormEntity.objectKey,
        thumbnailKey: ormEntity.thumbnailKey,
        originalName: ormEntity.originalFileName,
        mimeType: ormEntity.mimeType,
        sizeBytes: ormEntity.sizeBytes,
        width: ormEntity.width,
        height: ormEntity.height,
        checksumSha256: ormEntity.checksumSha256,
      },
      takenAt: ormEntity.takenAt,
      takenAtSource: ormEntity.takenAtSource,
      description: ormEntity.description,
      isPrimary: ormEntity.isPrimary,
      uploadedBy: {
        id: uploader.id,
        username: uploader.username,
        fullName: [
          uploader.firstName,
          uploader.paternalLastName,
          uploader.maternalLastName,
        ]
          .filter(Boolean)
          .join(' '),
      },
      uploadedAt: ormEntity.uploadedAt,
      audit: {
        createdAt: ormEntity.createdAt,
        createdBy: ormEntity.createdBy,
        updatedAt: ormEntity.updatedAt,
        updatedBy: ormEntity.updatedBy,
      },
    });
  }

  static toOrm(domainModel: AnimalPhoto): AnimalPhotoOrmEntity {
    const file = domainModel.getFile();
    const audit = domainModel.getAudit();
    const ormEntity = new AnimalPhotoOrmEntity();
    ormEntity.id = domainModel.getId();
    ormEntity.animal = { id: domainModel.getAnimalId() } as AnimalOrmEntity;
    ormEntity.objectKey = file.objectKey;
    ormEntity.thumbnailKey = file.thumbnailKey;
    ormEntity.originalFileName = file.originalName;
    ormEntity.mimeType = file.mimeType;
    ormEntity.sizeBytes = file.sizeBytes;
    ormEntity.width = file.width;
    ormEntity.height = file.height;
    ormEntity.checksumSha256 = file.checksumSha256;
    ormEntity.takenAt = domainModel.getTakenAt();
    ormEntity.takenAtSource = domainModel.getTakenAtSource();
    ormEntity.description = domainModel.getDescription();
    ormEntity.isPrimary = domainModel.getIsPrimary();
    ormEntity.uploadedBy = {
      id: domainModel.getUploadedBy().id,
    } as UserOrmEntity;
    ormEntity.uploadedAt = domainModel.getUploadedAt();
    ormEntity.createdBy = audit.createdBy;
    ormEntity.updatedBy = audit.updatedBy;
    return ormEntity;
  }
}
