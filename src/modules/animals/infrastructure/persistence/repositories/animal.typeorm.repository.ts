import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  AnimalFilters,
  IAnimalRepository,
  IdentifierMatch,
  OffspringStats,
} from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';
import { AnimalMapper } from '../mappers/animal.mapper';

@Injectable()
export class AnimalTypeormRepository implements IAnimalRepository {
  constructor(
    @InjectRepository(AnimalOrmEntity)
    private readonly repository: Repository<AnimalOrmEntity>,
  ) {}

  async findById(id: string): Promise<Animal | null> {
    const entity = await this.baseQuery()
      .where('animal.id = :id', { id })
      .getOne();
    return entity ? AnimalMapper.toDomain(entity) : null;
  }

  async findPaginated(
    filters: AnimalFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<Animal>> {
    const query = this.baseQuery().where('animal.isExternal = :isExternal', {
      isExternal: filters.isExternal,
    });

    if (filters.species) {
      query.andWhere('animal.species = :species', { species: filters.species });
    }
    if (filters.sex) {
      query.andWhere('animal.sex = :sex', { sex: filters.sex });
    }
    if (filters.status) {
      query.andWhere('animal.status = :status', { status: filters.status });
    }
    if (filters.geneticCategory) {
      query.andWhere('animal.geneticCategory = :geneticCategory', {
        geneticCategory: filters.geneticCategory,
      });
    }
    if (filters.breedId) {
      query.andWhere('breed.id = :breedId', { breedId: filters.breedId });
    }
    if (filters.colorId) {
      query.andWhere('color.id = :colorId', { colorId: filters.colorId });
    }
    if (filters.identifierException !== undefined) {
      query.andWhere('animal.identifierException = :identifierException', {
        identifierException: filters.identifierException,
      });
    }
    if (filters.parentId) {
      query.andWhere('(dam.id = :parentId OR sire.id = :parentId)', {
        parentId: filters.parentId,
      });
    }

    const search = filters.search?.trim();
    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('animal.earTag ILIKE :search')
            .orWhere('animal.name ILIKE :search')
            .orWhere('animal.absidRegistry ILIKE :search')
            .orWhere('animal.externalRegistry ILIKE :search');
        }),
        { search: `%${escapeLike(search)}%` },
      );
    }

    // Todas las relaciones son muchos-a-uno: no multiplican filas, así que
    // OFFSET/LIMIT directos paginan correctamente.
    const [entities, total] = await query
      .orderBy('animal.earTag', 'ASC', 'NULLS LAST')
      .addOrderBy('animal.name', 'ASC', 'NULLS LAST')
      .addOrderBy('animal.id', 'ASC')
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .getManyAndCount();

    return {
      items: entities.map((entity) => AnimalMapper.toDomain(entity)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async save(animal: Animal): Promise<void> {
    await this.repository.save(AnimalMapper.toOrm(animal));
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  async getOffspringStats(id: string): Promise<OffspringStats> {
    const rows: { total: string; earliest: string | null }[] =
      await this.repository.query(
        `SELECT COUNT(*) AS total, to_char(MIN(birth_date), 'YYYY-MM-DD') AS earliest
           FROM animals
          WHERE (dam_id = $1 OR sire_id = $1) AND deleted_at IS NULL`,
        [id],
      );
    return {
      count: Number(rows[0].total),
      earliestBirthDate: rows[0].earliest,
    };
  }

  async findIdentifierMatches(params: {
    earTag: string | null;
    absidRegistry: string | null;
    excludeId: string;
  }): Promise<IdentifierMatch[]> {
    if (!params.earTag && !params.absidRegistry) return [];
    const rows: IdentifierMatch[] = await this.repository.query(
      `SELECT id, ear_tag AS "earTag", name, absid_registry AS "absidRegistry",
              is_external AS "isExternal",
              identifier_exception AS "identifierException"
         FROM animals
        WHERE deleted_at IS NULL AND id <> $3
          AND (ear_tag = $1 OR absid_registry = $2)
        ORDER BY created_at`,
      [params.earTag, params.absidRegistry, params.excludeId],
    );
    return rows;
  }

  async isDescendant(
    ancestorId: string,
    candidateId: string,
  ): Promise<boolean> {
    // UNION (sin ALL) descarta filas repetidas y corta la recursión aunque
    // existieran datos inconsistentes.
    const rows: { found: boolean }[] = await this.repository.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM animals
          WHERE (dam_id = $1 OR sire_id = $1) AND deleted_at IS NULL
         UNION
         SELECT a.id FROM animals a
           JOIN descendants d ON a.dam_id = d.id OR a.sire_id = d.id
          WHERE a.deleted_at IS NULL
       )
       SELECT EXISTS (SELECT 1 FROM descendants WHERE id = $2) AS found`,
      [ancestorId, candidateId],
    );
    return rows[0].found;
  }

  private baseQuery() {
    return this.repository
      .createQueryBuilder('animal')
      .innerJoinAndSelect('animal.breed', 'breed')
      .leftJoinAndSelect('animal.color', 'color')
      .leftJoinAndSelect('animal.dam', 'dam')
      .leftJoinAndSelect('animal.sire', 'sire');
  }
}
