import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { AnimalMapper } from '@modules/animals/infrastructure/persistence/mappers/animal.mapper';
import { AnimalWeighingMapper } from '@modules/animals/infrastructure/persistence/mappers/animal-weighing.mapper';
import { GeneticCategoryChangeMapper } from '@modules/animals/infrastructure/persistence/mappers/genetic-category-change.mapper';
import {
  BirthFilters,
  BirthRegistration,
  IBirthRepository,
} from '../../../domain/repositories/reproduction.repository.interface';
import { Birth } from '../../../domain/models/birth.model';
import { BirthOrmEntity } from '../entities/birth.orm-entity';
import { BreedingServiceOrmEntity } from '../entities/breeding-service.orm-entity';
import {
  BirthMapper,
  BreedingServiceMapper,
} from '../mappers/reproduction.mappers';

@Injectable()
export class BirthTypeormRepository implements IBirthRepository {
  constructor(
    @InjectRepository(BirthOrmEntity)
    private readonly repository: Repository<BirthOrmEntity>,
  ) {}

  async findById(id: string): Promise<Birth | null> {
    const entity = await this.fullQuery().where('b.id = :id', { id }).getOne();
    return entity ? BirthMapper.toDomain(entity) : null;
  }

  async findByService(serviceId: string): Promise<Birth | null> {
    const entity = await this.fullQuery()
      .where('service.id = :serviceId', { serviceId })
      .getOne();
    return entity ? BirthMapper.toDomain(entity) : null;
  }

  async findPaginated(
    filters: BirthFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<Birth>> {
    // Primero la página de IDs (sin las crías, que multiplicarían filas).
    const query = this.repository
      .createQueryBuilder('b')
      .innerJoin('b.dam', 'dam')
      .leftJoin('b.sire', 'sire')
      .select(['b.id', 'b.birthDate', 'b.createdAt']);
    if (filters.species) {
      query.andWhere('b.species = :species', { species: filters.species });
    }
    if (filters.animalId) {
      query.andWhere(
        `(dam.id = :animalId OR sire.id = :animalId OR EXISTS (SELECT 1 FROM birth_offspring o WHERE o.birth_id = b.id AND o.animal_id = :animalId))`,
        { animalId: filters.animalId },
      );
    }
    if (filters.damId)
      query.andWhere('dam.id = :damId', { damId: filters.damId });
    if (filters.sireId) {
      query.andWhere('sire.id = :sireId', { sireId: filters.sireId });
    }
    if (filters.from)
      query.andWhere('b.birthDate >= :from', { from: filters.from });
    if (filters.to) query.andWhere('b.birthDate <= :to', { to: filters.to });
    if (filters.isHistorical !== undefined) {
      query.andWhere('b.isHistorical = :isHistorical', {
        isHistorical: filters.isHistorical,
      });
    }
    if (filters.litterSize) {
      query.andWhere(
        '(SELECT COUNT(*) FROM birth_offspring o WHERE o.birth_id = b.id) = :litterSize',
        { litterSize: filters.litterSize },
      );
    }
    const [page, total] = await query
      .orderBy('b.birthDate', 'DESC')
      .addOrderBy('b.createdAt', 'DESC')
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .getManyAndCount();

    const ids = page.map((p) => p.id);
    const entities = ids.length
      ? await this.fullQuery().where('b.id IN (:...ids)', { ids }).getMany()
      : [];
    const byId = new Map(entities.map((e) => [e.id, e]));
    return {
      items: ids.map((id) => BirthMapper.toDomain(byId.get(id)!)),
      total,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  async findDamBirthsBetween(
    damId: string,
    from: string,
    to: string,
  ): Promise<Birth[]> {
    const entities = await this.fullQuery()
      .where('dam.id = :damId', { damId })
      .andWhere('b.birthDate BETWEEN :from AND :to', { from, to })
      .orderBy('b.birthDate', 'ASC')
      .getMany();
    return entities.map((e) => BirthMapper.toDomain(e));
  }

  async register(r: BirthRegistration): Promise<void> {
    await this.repository.manager.transaction(async (manager) => {
      // Primero las crías: el parto las referencia.
      for (const animal of r.animals) {
        await manager.save(AnimalMapper.toOrm(animal));
      }
      if (r.weighings.length > 0) {
        await manager.save(
          r.weighings.map((w) => AnimalWeighingMapper.toOrm(w)),
        );
      }
      if (r.categoryChanges.length > 0) {
        await manager.save(
          r.categoryChanges.map((c) => GeneticCategoryChangeMapper.toOrm(c)),
        );
      }
      if (r.service) {
        r.service.markUpdatedBy(r.actorId);
        await manager.update(
          BreedingServiceOrmEntity,
          { id: r.service.getId() },
          {
            status: BreedingServiceMapper.toOrm(r.service).status,
            updatedBy: r.actorId,
          },
        );
      }
      await manager.save(BirthMapper.toOrm(r.birth));
    });
  }

  async save(birth: Birth): Promise<void> {
    await this.repository.update(
      { id: birth.getId() },
      {
        assistance: birth.getAssistance(),
        notes: birth.getNotes(),
        updatedBy: birth.getAudit().updatedBy,
      },
    );
  }

  private fullQuery() {
    return this.repository
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.service', 'service')
      .innerJoinAndSelect('b.dam', 'dam')
      .leftJoinAndSelect('b.sire', 'sire')
      .leftJoinAndSelect('b.offspring', 'offspring')
      .leftJoinAndSelect('offspring.animal', 'offspringAnimal');
  }
}
