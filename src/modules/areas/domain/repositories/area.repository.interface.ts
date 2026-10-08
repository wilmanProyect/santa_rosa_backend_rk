import { Area } from '../models/area.model';

export interface AreaFilters {
  isActive?: boolean;
}

export interface IAreaRepository {
  findById(id: string): Promise<Area | null>;
  findByName(name: string): Promise<Area | null>;
  findAll(filters: AreaFilters): Promise<Area[]>;
  save(area: Area): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
  /** Cantidad de usuarios y roles que todavía referencian el área. */
  countUsages(id: string): Promise<{ users: number; roles: number }>;
}

export const AREA_REPOSITORY = Symbol('IAreaRepository');
