import { VeterinaryProduct } from '../models/veterinary-product.model';
import { ProductCategory } from '../enums/veterinary.enums';

export interface VeterinaryProductFilters {
  search?: string;
  category?: ProductCategory;
  isActive?: boolean;
}

export interface IVeterinaryProductRepository {
  findById(id: string): Promise<VeterinaryProduct | null>;
  /** Búsqueda exacta sin distinguir mayúsculas. */
  findByName(name: string): Promise<VeterinaryProduct | null>;
  findAll(filters: VeterinaryProductFilters): Promise<VeterinaryProduct[]>;
  save(product: VeterinaryProduct): Promise<void>;
  softDelete(id: string, actorId: string): Promise<void>;
  /** Registros sanitarios (no eliminados) que usan el producto. */
  countUsages(id: string): Promise<number>;
}

export const VETERINARY_PRODUCT_REPOSITORY = Symbol(
  'IVeterinaryProductRepository',
);
