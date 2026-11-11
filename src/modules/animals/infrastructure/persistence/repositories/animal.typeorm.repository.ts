import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  AnimalFilters,
  IAnimalRepository,
  BirthLink,
  IdentifierMatch,
  OffspringStats,
  SaveAnimalOptions,
} from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { AnimalOrmEntity } from '../entities/animal.orm-entity';
import { AnimalMapper } from '../mappers/animal.mapper';
import { GeneticCategoryChange } from '../../../domain/models/genetic-category-change';
import { GeneticCategoryChangeOrmEntity } from '../entities/genetic-category-change.orm-entity';
import { GeneticCategoryChangeMapper } from '../mappers/genetic-category-change.mapper';
import { Species } from '../../../domain/enums/animal.enums';

@Injectable()
export class AnimalTypeormRepository implements IAnimalRepository {
  constructor(
    @InjectRepository(AnimalOrmEntity)
    private readonly repository: Repository<AnimalOrmEntity>,
    @InjectRepository(GeneticCategoryChangeOrmEntity)
    private readonly categoryChanges: Repository<GeneticCategoryChangeOrmEntity>,
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

  async save(
    animal: Animal,
    categoryChange?: GeneticCategoryChange,
    options: SaveAnimalOptions = {},
  ): Promise<void> {
    const sync = options.syncHistoricalBirth;
    if (!categoryChange && !sync) {
      await this.repository.save(AnimalMapper.toOrm(animal));
      return;
    }
    await this.repository.manager.transaction(async (manager) => {
      await manager.save(AnimalMapper.toOrm(animal));
      if (categoryChange) {
        await manager.save(GeneticCategoryChangeMapper.toOrm(categoryChange));
      }
      if (sync) {
        await syncHistoricalBirth(manager, animal.getId(), sync.actorId);
      }
    });
  }

  async findBirthLink(id: string): Promise<BirthLink | null> {
    const rows: BirthLink[] = await this.repository.query(
      `SELECT b.id AS "birthId", b.is_historical AS "isHistorical",
              to_char(b.birth_date, 'YYYY-MM-DD') AS "birthDate"
         FROM birth_offspring bo
         JOIN births b ON b.id = bo.birth_id AND b.deleted_at IS NULL
        WHERE bo.animal_id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async findGeneticCategoryHistory(
    animalId: string,
  ): Promise<GeneticCategoryChange[]> {
    const entities = await this.categoryChanges.find({
      where: { animal: { id: animalId } },
      relations: { animal: true },
      order: { changedOn: 'ASC', createdAt: 'ASC' },
    });
    return entities.map((e) => GeneticCategoryChangeMapper.toDomain(e));
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

  async countBreedingRecords(
    id: string,
  ): Promise<{ services: number; births: number }> {
    const rows: { services: string; births: string }[] =
      await this.repository.query(
        `SELECT (SELECT COUNT(*) FROM breeding_services
                  WHERE (dam_id = $1 OR sire_id = $1) AND deleted_at IS NULL) AS services,
                (SELECT COUNT(*) FROM births
                  WHERE (dam_id = $1 OR sire_id = $1) AND deleted_at IS NULL) AS births`,
        [id],
      );
    return {
      services: Number(rows[0].services),
      births: Number(rows[0].births),
    };
  }

  async findIdentifierMatches(params: {
    species: Species;
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
        WHERE deleted_at IS NULL AND id <> $3 AND species = $4
          AND (ear_tag = $1 OR absid_registry = $2)
        ORDER BY created_at`,
      [params.earTag, params.absidRegistry, params.excludeId, params.species],
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

interface SyncAnimalRow {
  dam_id: string | null;
  sex: string;
  entry_origin: string | null;
  deleted_at: Date | null;
  birth_date: string | null;
  dam_species: string | null;
}

interface BirthStatsRow {
  total: number;
  with_sire: number;
  sires: number;
  sire_id: string | null;
}

interface SyncLinkRow {
  offspring_id: string;
  birth_id: string;
  dam_id: string;
  is_historical: boolean;
  birth_date: string;
}

/**
 * Mantiene coherente el parto histórico de una cría después de corregir su
 * madre, su padre o su fecha de nacimiento. Los partos históricos agrupan las
 * crías nacidas en la cabaña con la misma madre y fecha (ver la migración
 * Reproduction). Si la cría pasa a otro grupo, se mueve al parto de ese grupo
 * (o a uno nuevo) y el parto que se queda sin crías se elimina. El padre del
 * parto es el de sus crías, o ninguno si no coinciden.
 */
async function syncHistoricalBirth(
  manager: EntityManager,
  animalId: string,
  actorId: string,
): Promise<void> {
  const [animal] = await manager.query<SyncAnimalRow[]>(
    `SELECT a.dam_id, a.sex, a.entry_origin, a.deleted_at,
            to_char(a.birth_date, 'YYYY-MM-DD') AS birth_date, d.species AS dam_species
       FROM animals a LEFT JOIN animals d ON d.id = a.dam_id
      WHERE a.id = $1`,
    [animalId],
  );
  if (!animal) return;
  const [link] = await manager.query<SyncLinkRow[]>(
    `SELECT bo.id AS offspring_id, b.id AS birth_id, b.dam_id, b.is_historical,
            to_char(b.birth_date, 'YYYY-MM-DD') AS birth_date
       FROM birth_offspring bo
       JOIN births b ON b.id = bo.birth_id AND b.deleted_at IS NULL
      WHERE bo.animal_id = $1`,
    [animalId],
  );
  // Los partos registrados con el formulario no se tocan: la API no permite
  // cambiar la madre, el padre ni la fecha de esas crías (UpdateAnimalUseCase).
  if (link && !link.is_historical) return;

  const qualifies =
    animal.deleted_at === null &&
    animal.entry_origin === 'BORN_ON_FARM' &&
    animal.dam_id !== null &&
    animal.birth_date !== null;
  const touched = new Set<string>();
  let placed = false;

  if (link) {
    touched.add(link.birth_id);
    if (
      qualifies &&
      link.dam_id === animal.dam_id &&
      link.birth_date === animal.birth_date
    ) {
      await manager.query(`UPDATE birth_offspring SET sex = $2 WHERE id = $1`, [
        link.offspring_id,
        animal.sex,
      ]);
      placed = true;
    } else {
      await manager.query(`DELETE FROM birth_offspring WHERE id = $1`, [
        link.offspring_id,
      ]);
    }
  }

  if (qualifies && !placed) {
    const [target] = await manager.query<{ id: string }[]>(
      `SELECT id FROM births
        WHERE dam_id = $1 AND birth_date = $2 AND is_historical AND deleted_at IS NULL
        ORDER BY created_at LIMIT 1`,
      [animal.dam_id, animal.birth_date],
    );
    let birthId = target?.id;
    if (!birthId) {
      birthId = randomUUID();
      await manager.query(
        `INSERT INTO births (id, species, birth_date, is_historical, notes, dam_id, created_by, updated_by)
         VALUES ($1, $2, $3, true, $4, $5, $6, $6)`,
        [
          birthId,
          animal.dam_species,
          animal.birth_date,
          'Histórico: creado al corregir la madre o la fecha de nacimiento de la cría.',
          animal.dam_id,
          actorId,
        ],
      );
    }
    await manager.query(
      `INSERT INTO birth_offspring (id, position, sex, born_alive, birth_weight_kg, birth_id, animal_id)
       SELECT $1,
              COALESCE((SELECT MAX(position) FROM birth_offspring WHERE birth_id = $2), 0) + 1,
              $3, true,
              (SELECT weight_kg FROM animal_weighings
                WHERE animal_id = $4 AND type = 'BIRTH' AND deleted_at IS NULL
                ORDER BY created_at LIMIT 1),
              $2, $4`,
      [randomUUID(), birthId, animal.sex, animalId],
    );
    touched.add(birthId);
  }

  for (const birthId of touched) {
    await refreshHistoricalBirth(manager, birthId, actorId);
  }
}

/** Recalcula el padre del parto, o lo elimina si se quedó sin crías. */
async function refreshHistoricalBirth(
  manager: EntityManager,
  birthId: string,
  actorId: string,
): Promise<void> {
  const [stats] = await manager.query<BirthStatsRow[]>(
    `SELECT COUNT(*)::int AS total,
            COUNT(a.sire_id)::int AS with_sire,
            COUNT(DISTINCT a.sire_id)::int AS sires,
            MAX(a.sire_id::text) AS sire_id
       FROM birth_offspring bo
       LEFT JOIN animals a ON a.id = bo.animal_id
      WHERE bo.birth_id = $1`,
    [birthId],
  );
  if (stats.total === 0) {
    await manager.query(
      `UPDATE births SET deleted_at = now(), updated_at = now(), updated_by = $2 WHERE id = $1`,
      [birthId, actorId],
    );
    return;
  }
  const sireId =
    stats.sires === 1 && stats.with_sire === stats.total ? stats.sire_id : null;
  await manager.query(
    `UPDATE births SET sire_id = $2::uuid, updated_at = now(), updated_by = $3
      WHERE id = $1 AND is_historical AND sire_id IS DISTINCT FROM $2::uuid`,
    [birthId, sireId, actorId],
  );
}
