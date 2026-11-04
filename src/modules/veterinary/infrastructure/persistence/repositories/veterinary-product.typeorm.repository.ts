import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  IVeterinaryProductRepository,
  VeterinaryProductFilters,
} from '../../../domain/repositories/veterinary-product.repository.interface';
import { VeterinaryProduct } from '../../../domain/models/veterinary-product.model';
import { VeterinaryProductOrmEntity } from '../entities/veterinary-product.orm-entity';
import { VeterinaryProductMapper } from '../mappers/veterinary-product.mapper';

@Injectable()
export class VeterinaryProductTypeormRepository implements IVeterinaryProductRepository {
  constructor(
    @InjectRepository(VeterinaryProductOrmEntity)
    private readonly repository: Repository<VeterinaryProductOrmEntity>,
  ) {}

  async findById(id: string): Promise<VeterinaryProduct | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? VeterinaryProductMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<VeterinaryProduct | null> {
    const entity = await this.repository
      .createQueryBuilder('p')
      .where('lower(p.name) = lower(:name)', { name })
      .getOne();
    return entity ? VeterinaryProductMapper.toDomain(entity) : null;
  }

  async findAll(
    filters: VeterinaryProductFilters,
  ): Promise<VeterinaryProduct[]> {
    const query = this.repository.createQueryBuilder('p');
    if (filters.category) {
      query.andWhere('p.category = :category', { category: filters.category });
    }
    if (filters.isActive !== undefined) {
      query.andWhere('p.isActive = :isActive', { isActive: filters.isActive });
    }
    const search = filters.search?.trim();
    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('p.name ILIKE :search')
            .orWhere('p.activeIngredient ILIKE :search')
            .orWhere('p.manufacturer ILIKE :search');
        }),
        { search: `%${escapeLike(search)}%` },
      );
    }
    const entities = await query.orderBy('p.name', 'ASC').getMany();
    return entities.map((e) => VeterinaryProductMapper.toDomain(e));
  }

  async save(product: VeterinaryProduct): Promise<void> {
    await this.repository.save(VeterinaryProductMapper.toOrm(product));
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  async countUsages(id: string): Promise<number> {
    const rows: { total: string }[] = await this.repository.query(
      `SELECT COUNT(*) AS total FROM health_records WHERE product_id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return Number(rows[0].total);
  }
}
