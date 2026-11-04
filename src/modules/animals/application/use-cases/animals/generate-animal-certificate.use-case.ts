import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import type { IFileStorage } from '@shared/application/ports/file-storage.interface';
import { IMAGE_PROCESSOR } from '@shared/application/ports/image-processor.interface';
import type { IImageProcessor } from '@shared/application/ports/image-processor.interface';
import { GetUserUseCase } from '@modules/users/application/use-cases/get-user.use-case';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { ANIMAL_WEIGHING_REPOSITORY } from '../../../domain/repositories/animal-weighing.repository.interface';
import type { IAnimalWeighingRepository } from '../../../domain/repositories/animal-weighing.repository.interface';
import { HEALTH_RECORD_REPOSITORY } from '../../../domain/repositories/health-record.repository.interface';
import type { IHealthRecordRepository } from '../../../domain/repositories/health-record.repository.interface';
import { ANIMAL_PHOTO_REPOSITORY } from '../../../domain/repositories/animal-photo.repository.interface';
import type { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { AnimalParent } from '../../../domain/models/animal-parent';
import {
  ANIMAL_CERTIFICATE_RENDERER,
  CERTIFICATE_MAX_ROWS,
  CertificateFarm,
  PedigreeNode,
} from '../../ports/animal-certificate-renderer.interface';
import type { IAnimalCertificateRenderer } from '../../ports/animal-certificate-renderer.interface';
import { HealthRecordService } from '../health/health-record.service';
import { GetAnimalUseCase } from './get-animal.use-case';

/** Lado mayor de la foto incrustada en el PDF, en píxeles. */
const CERTIFICATE_PHOTO_MAX_SIDE = 600;

export interface GeneratedCertificate {
  number: string;
  fileName: string;
  content: Buffer;
}

/**
 * Certificado del animal: ficha completa en PDF con identificación, registro
 * ABSID, origen, estado, genealogía de tres generaciones, pesos y registro
 * sanitario. Se genera en el momento con los datos vigentes; no se guarda.
 */
@Injectable()
export class GenerateAnimalCertificateUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(ANIMAL_WEIGHING_REPOSITORY)
    private readonly weighingRepository: IAnimalWeighingRepository,
    @Inject(HEALTH_RECORD_REPOSITORY)
    private readonly healthRepository: IHealthRecordRepository,
    @Inject(ANIMAL_PHOTO_REPOSITORY)
    private readonly photoRepository: IAnimalPhotoRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    @Inject(IMAGE_PROCESSOR)
    private readonly imageProcessor: IImageProcessor,
    @Inject(ANIMAL_CERTIFICATE_RENDERER)
    private readonly renderer: IAnimalCertificateRenderer,
    private readonly getAnimalUseCase: GetAnimalUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly health: HealthRecordService,
    private readonly config: ConfigService,
  ) {}

  async execute(actorId: string, id: string): Promise<GeneratedCertificate> {
    const animal = await this.getAnimalUseCase.execute(id);
    if (animal.getIsExternal()) {
      throw new BadRequestException(
        'Los animales externos no pertenecen a la cabaña: no se les emite certificado',
      );
    }

    const [
      issuer,
      sire,
      dam,
      offspring,
      weights,
      weighings,
      health,
      withdrawal,
      photo,
    ] = await Promise.all([
      this.getUserUseCase.execute(actorId),
      this.pedigreeNode(animal.getSire()),
      this.pedigreeNode(animal.getDam()),
      this.animalRepository.getOffspringStats(id),
      this.weighingRepository.findSummary(id),
      this.weighingRepository.findByAnimal(id),
      this.healthRepository.findPaginated(
        { animalId: id },
        { page: 1, limit: CERTIFICATE_MAX_ROWS },
      ),
      this.health.withdrawal(animal),
      this.primaryPhoto(id),
    ]);

    const issuedAt = new Date();
    const number = certificateNumber(issuedAt);
    const content = await this.renderer.render({
      number,
      farm: this.farm(),
      timeZone: this.config.get<string>('FARM_TIME_ZONE', 'America/La_Paz'),
      issuedAt,
      issuedBy: {
        username: issuer.getUsername().getValue(),
        fullName: issuer.getFullName(),
      },
      animal,
      photoJpeg: photo?.jpeg ?? null,
      photoTakenAt: photo?.takenAt ?? null,
      sire,
      dam,
      offspringCount: offspring.count,
      weights,
      weighings: [...weighings].reverse().slice(0, CERTIFICATE_MAX_ROWS),
      totalWeighings: weighings.length,
      healthRecords: health.items,
      totalHealthRecords: health.total,
      withdrawal,
    });

    const label = (animal.getEarTag() ?? animal.getId())
      .replace(/[^0-9A-Za-z_-]+/g, '-')
      .slice(0, 40);
    return { number, fileName: `certificado-${label}.pdf`, content };
  }

  private farm(): CertificateFarm {
    const text = (key: string, fallback: string) =>
      this.config.get<string>(key, fallback).trim() || null;
    return {
      name: text('FARM_NAME', 'Cabaña Santa Rosa') ?? 'Cabaña Santa Rosa',
      code: text('FARM_CODE', '28-A'),
      // Separados por coma; firman en ese orden.
      breeders: (
        text('FARM_BREEDERS', 'Ricardo Limpias Mateff, Katlyn Los') ?? ''
      )
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean),
      locality: text('FARM_LOCALITY', 'Portachuelo'),
      phone: text('FARM_PHONE', '69405387'),
      region: text('FARM_REGION', 'Santa Cruz - Bolivia'),
    };
  }

  /** Padre o madre con sus propios padres (abuelos del animal). */
  private async pedigreeNode(
    parent: AnimalParent | null,
  ): Promise<PedigreeNode | null> {
    if (!parent) return null;
    const animal = await this.animalRepository.findById(parent.id);
    if (!animal) return null;
    const [sire, dam] = await Promise.all([
      this.findAnimal(animal.getSire()),
      this.findAnimal(animal.getDam()),
    ]);
    return { animal, sire, dam };
  }

  private async findAnimal(
    parent: AnimalParent | null,
  ): Promise<Animal | null> {
    return parent ? this.animalRepository.findById(parent.id) : null;
  }

  /**
   * La foto principal, en JPEG. Si no se puede leer del almacenamiento, el
   * certificado se genera igual, sin foto.
   */
  private async primaryPhoto(
    animalId: string,
  ): Promise<{ jpeg: Buffer; takenAt: string | null } | null> {
    const [photo] = await this.photoRepository.findPrimaryByAnimalIds([
      animalId,
    ]);
    if (!photo) return null;
    try {
      const original = await this.fileStorage.read(photo.getFile().objectKey);
      if (!original) return null;
      return {
        jpeg: await this.imageProcessor.toJpeg(
          original,
          CERTIFICATE_PHOTO_MAX_SIDE,
        ),
        takenAt: photo.getTakenAt(),
      };
    } catch {
      return null;
    }
  }
}

/** p. ej. "SR-20261104-7F3A9C": fecha de emisión + sufijo aleatorio. */
function certificateNumber(issuedAt: Date): string {
  const date = issuedAt.toISOString().slice(0, 10).replace(/-/g, '');
  return `SR-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
