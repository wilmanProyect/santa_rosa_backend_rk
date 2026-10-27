import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  AnimalColorFilters,
  IAnimalColorRepository,
} from '../../../domain/repositories/animal-color.repository.interface';
import { AnimalColor } from '../../../domain/models/animal-color.model';
import { AnimalColorOrmEntity } from '../entities/animal-color.orm-entity';
import { AnimalColorMapper } from '../mappers/animal-color.mapper';

@Injectable()
export class AnimalColorTypeormRepository implements IAnimalColorRepository {
  constructor(
    @InjectRepository(AnimalColorOrmEntity)
    private readonly repository: Repository<AnimalColorOrmEntity>,
  ) {}

  async findById(id: string): Promise<AnimalColor | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? AnimalColorMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<AnimalColor | null> {
    const entity = await this.repository.findOne({
      where: { name: ILike(escapeLike(name)) },
    });
    return entity ? AnimalColorMapper.toDomain(entity) : null;
  }

  async findAll(filters: AnimalColorFilters): Promise<AnimalColor[]> {
    const where: FindOptionsWhere<AnimalColorOrmEntity> = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const entities = await this.repository.find({
      where,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => AnimalColorMapper.toDomain(entity));
  }

  async save(color: AnimalColor): Promise<void> {
    await this.repository.save(AnimalColorMapper.toOrm(color));
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  async countAnimals(id: string): Promise<number> {
    const rows: { total: string }[] = await this.repository.query(
      `SELECT COUNT(*) AS total FROM animals WHERE color_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return Number(rows[0].total);
  }
}
