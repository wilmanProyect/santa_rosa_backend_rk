import { AnimalPhoto } from '../../domain/models/animal-photo.model';
import type { PhotoUrls } from '../../application/services/animal-photo-url.service';

export class AnimalPhotoPresenter {
  static toResponse(photo: AnimalPhoto, urls: PhotoUrls) {
    const file = photo.getFile();
    const audit = photo.getAudit();
    return {
      id: photo.getId(),
      animalId: photo.getAnimalId(),
      isPrimary: photo.getIsPrimary(),
      description: photo.getDescription(),
      takenAt: photo.getTakenAt(),
      takenAtSource: photo.getTakenAtSource(),
      uploadedAt: photo.getUploadedAt(),
      uploadedBy: photo.getUploadedBy(),
      file: {
        fileName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        width: file.width,
        height: file.height,
        checksumSha256: file.checksumSha256,
      },
      ...urls,
      updatedAt: audit.updatedAt,
      updatedBy: audit.updatedBy,
    };
  }
}
