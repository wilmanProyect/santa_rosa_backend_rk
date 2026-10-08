import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { User } from '../models/user.model';
import { UserStatus } from '../enums/user-status.enum';

export interface UserFilters {
  /** Busca en nombres, apellidos, usuario, CI y correo. */
  search?: string;
  status?: UserStatus;
  areaId?: string;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByCiNumber(ciNumber: string): Promise<User | null>;
  findPaginated(
    filters: UserFilters,
    pagination: PaginationParams,
  ): Promise<Paginated<User>>;
  /** Cantidad de usuarios activos (no eliminados) con el rol indicado. */
  countActiveWithRole(roleId: string): Promise<number>;
  save(user: User): Promise<void>;
  /** Guarda solo los campos que cambian en un login, sin tocar roles ni permisos. */
  saveLoginState(user: User): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
}

export const USER_REPOSITORY = Symbol('IUserRepository');
