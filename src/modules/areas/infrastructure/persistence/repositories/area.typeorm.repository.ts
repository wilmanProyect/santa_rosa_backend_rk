import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  AreaFilters,
  IAreaRepository,
} from '../../../domain/repositories/area.repository.interface';
import { Area } from '../../../domain/models/area.model';
import { AreaOrmEntity } from '../entities/area.orm-entity';
import { AreaMapper } from '../mappers/area.mapper';

@Injectable()
export class AreaTypeormRepository implements IAreaRepository {
  constructor(
    @InjectRepository(AreaOrmEntity)
    private readonly repository: Repository<AreaOrmEntity>,
  ) {}

  async findById(id: string): Promise<Area | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? AreaMapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<Area | null> {
    const entity = await this.repository.findOne({ where: { name } });
    return entity ? AreaMapper.toDomain(entity) : null;
  }

  async findAll(filters: AreaFilters): Promise<Area[]> {
    const where: FindOptionsWhere<AreaOrmEntity> = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    const entities = await this.repository.find({
      where,
      order: { name: 'ASC' },
    });
    return entities.map((entity) => AreaMapper.toDomain(entity));
  }

  async save(area: Area): Promise<void> {
    await this.repository.save(AreaMapper.toOrm(area));
  }

  async softDelete(id: string, actorId: string): Promise<void> {
    await this.repository.update({ id }, { updatedBy: actorId });
    await this.repository.softDelete({ id });
  }

  async countUsages(id: string): Promise<{ users: number; roles: number }> {
    const rows: { users: string; roles: string }[] =
      await this.repository.query(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE area_id = $1 AND deleted_at IS NULL) AS users,
           (SELECT COUNT(*) FROM roles WHERE area_id = $1 AND deleted_at IS NULL) AS roles`,
        [id],
      );
    return { users: Number(rows[0].users), roles: Number(rows[0].roles) };
  }
}
