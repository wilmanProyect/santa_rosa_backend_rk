import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { IAnimalPhotoRepository } from '../../../domain/repositories/animal-photo.repository.interface';
import { AnimalPhoto } from '../../../domain/models/animal-photo.model';
import { AnimalPhotoOrmEntity } from '../entities/animal-photo.orm-entity';
import { AnimalPhotoMapper } from '../mappers/animal-photo.mapper';

/** Fecha de la foto o, si no la tiene, fecha de subida. */
const SORT_DATE = `COALESCE(photo.taken_at, photo.uploaded_at::date)`;

@Injectable()
export class AnimalPhotoTypeormRepository implements IAnimalPhotoRepository {
  constructor(
    @InjectRepository(AnimalPhotoOrmEntity)
    private readonly repository: Repository<AnimalPhotoOrmEntity>,
  ) {}

  async findById(
    animalId: string,
    photoId: string,
  ): Promise<AnimalPhoto | null> {
    const entity = await this.repository.findOne({
      where: { id: photoId, animal: { id: animalId } },
      relations: { animal: true, uploadedBy: true },
    });
    return entity ? AnimalPhotoMapper.toDomain(entity) : null;
  }

  async findByChecksum(
    animalId: string,
    checksumSha256: string,
  ): Promise<AnimalPhoto | null> {
    const entity = await this.repository.findOne({
      where: { checksumSha256, animal: { id: animalId } },
      relations: { animal: true, uploadedBy: true },
    });
    return entity ? AnimalPhotoMapper.toDomain(entity) : null;
  }

  async findPaginated(
    animalId: string,
    pagination: PaginationParams,
  ): Promise<Paginated<AnimalPhoto>> {
    const [entities, total] = await this.repository
      .createQueryBuilder('photo')
      .innerJoinAndSelect('photo.animal', 'animal')
      .innerJoinAndSelect('photo.uploadedBy', 'uploadedBy')
      .where('animal.id = :animalId', { animalId })
      .addSelect(SORT_DATE, 'sort_date')
      .orderBy('sort_date', 'DESC')
      .addOrderBy('photo.uploadedAt', 'DESC')
      .addOrderBy('photo.id', 'ASC')
      // Relaciones muchos-a-uno: OFFSET/LIMIT directos paginan bien.
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .getManyAndCount();

    return {
      items: entities.map((entity) => AnimalPhotoMapper.toDomain(entity)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findPrimaryByAnimalIds(animalIds: string[]): Promise<AnimalPhoto[]> {
    if (animalIds.length === 0) return [];
    const entities = await this.repository.find({
      where: { isPrimary: true, animal: { id: In(animalIds) } },
      relations: { animal: true, uploadedBy: true },
    });
    return entities.map((entity) => AnimalPhotoMapper.toDomain(entity));
  }

  async countByAnimal(animalId: string): Promise<number> {
    return this.repository.count({ where: { animal: { id: animalId } } });
  }

  async create(photo: AnimalPhoto): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      if (photo.getIsPrimary()) {
        await this.clearPrimary(manager, photo.getAnimalId());
      }
      await manager.insert(
        AnimalPhotoOrmEntity,
        AnimalPhotoMapper.toOrm(photo),
      );
    });
  }

  async update(photo: AnimalPhoto): Promise<void> {
    await this.repository.update(
      { id: photo.getId() },
      {
        description: photo.getDescription(),
        takenAt: photo.getTakenAt(),
        takenAtSource: photo.getTakenAtSource(),
        updatedBy: photo.getAudit().updatedBy,
      },
    );
  }

  async setPrimary(photo: AnimalPhoto, actorId: string): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await this.clearPrimary(manager, photo.getAnimalId());
      await manager.update(
        AnimalPhotoOrmEntity,
        { id: photo.getId() },
        { isPrimary: true, updatedBy: actorId },
      );
    });
  }

  async softDelete(photo: AnimalPhoto, actorId: string): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      await manager.update(
        AnimalPhotoOrmEntity,
        { id: photo.getId() },
        { isPrimary: false, updatedBy: actorId, deletedAt: () => 'now()' },
      );
      if (photo.getIsPrimary()) {
        await manager.query(
          `UPDATE animal_photos SET is_primary = true
            WHERE id = (
              SELECT id FROM animal_photos photo
               WHERE photo.animal_id = $1 AND photo.deleted_at IS NULL
               ORDER BY ${SORT_DATE} DESC, photo.uploaded_at DESC, photo.id
               LIMIT 1)`,
          [photo.getAnimalId()],
        );
      }
    });
  }

  private async clearPrimary(manager: EntityManager, animalId: string) {
    await manager.query(
      `UPDATE animal_photos SET is_primary = false
        WHERE animal_id = $1 AND is_primary AND deleted_at IS NULL`,
      [animalId],
    );
  }
}
