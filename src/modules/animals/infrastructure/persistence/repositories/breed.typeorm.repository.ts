import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  BreedFilters,
  IBreedRepository,
} from '../../../domain/repositories/breed.repository.interface';
import { Breed } from '../../../domain/models/breed.model';
import { Species } from '../../../domain/enums/animal.enums';
import { BreedOrmEntity } from '../entities/breed.orm-entity';
import { BreedMapper } from '../mappers/breed.mapper';

@Injectable()
export class BreedTypeormRepository implements IBreedRepository {
  constructor(
    @InjectRepository(BreedOrmEntity)
    private readonly repository: Repository<BreedOrmEntity>,
  ) {}

  async findById(id: string): Promise<Breed | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? BreedMapper.toDomain(entity) : null;
  }

  async findByName(species: Species, name: string): Promise<Breed | null> {
    const entity = await this.repository.findOne({
      where: { species, name: ILike(escapeLike(name)) },
    });
    return entity ? BreedMapper.toDomain(entity) : null;
  }

  async findAll(filters: BreedFilters): Promise<Breed[]> {
    const where: FindOptionsWhere<BreedOrmEntity> = {};
    if (filters.species !== undefined) where.species = filters.species;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const entities = await this.repository.find({
      where,
      order: { species: 'ASC', name: 'ASC' },
    });
    return entities.map((entity) => BreedMapper.toDomain(entity));
  }

  async save(breed: Breed): Promise<void> {
    await this.repository.save(BreedMapper.toOrm(breed));
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  async countAnimals(id: string): Promise<number> {
    const rows: { total: string }[] = await this.repository.query(
      `SELECT COUNT(*) AS total FROM animals WHERE breed_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return Number(rows[0].total);
  }
}
