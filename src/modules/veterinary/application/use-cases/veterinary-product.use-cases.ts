import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { VETERINARY_PRODUCT_REPOSITORY } from '../../domain/repositories/veterinary-product.repository.interface';
import type {
  IVeterinaryProductRepository,
  VeterinaryProductFilters,
} from '../../domain/repositories/veterinary-product.repository.interface';
import { VeterinaryProduct } from '../../domain/models/veterinary-product.model';
import { CreateVeterinaryProductDto } from '../dtos/create-veterinary-product.dto';
import { UpdateVeterinaryProductDto } from '../dtos/update-veterinary-product.dto';

@Injectable()
export class GetVeterinaryProductUseCase {
  constructor(
    @Inject(VETERINARY_PRODUCT_REPOSITORY)
    private readonly repository: IVeterinaryProductRepository,
  ) {}

  async execute(id: string): Promise<VeterinaryProduct> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw new NotFoundException(`No se encontró el producto con ID "${id}"`);
    }
    return product;
  }

  /** Igual que execute, pero exige que esté activo (para registrar aplicaciones). */
  async executeActive(id: string): Promise<VeterinaryProduct> {
    const product = await this.execute(id);
    if (!product.getIsActive()) {
      throw new NotFoundException(
        `El producto "${product.getName()}" está inactivo`,
      );
    }
    return product;
  }
}

@Injectable()
export class ListVeterinaryProductsUseCase {
  constructor(
    @Inject(VETERINARY_PRODUCT_REPOSITORY)
    private readonly repository: IVeterinaryProductRepository,
  ) {}

  execute(filters: VeterinaryProductFilters): Promise<VeterinaryProduct[]> {
    return this.repository.findAll(filters);
  }
}

@Injectable()
export class CreateVeterinaryProductUseCase {
  constructor(
    @Inject(VETERINARY_PRODUCT_REPOSITORY)
    private readonly repository: IVeterinaryProductRepository,
  ) {}

  async execute(
    actorId: string,
    dto: CreateVeterinaryProductDto,
  ): Promise<VeterinaryProduct> {
    const product = VeterinaryProduct.create({ ...dto, createdBy: actorId });
    await assertNameAvailable(this.repository, product);
    await this.repository.save(product);
    return product;
  }
}

@Injectable()
export class UpdateVeterinaryProductUseCase {
  constructor(
    @Inject(VETERINARY_PRODUCT_REPOSITORY)
    private readonly repository: IVeterinaryProductRepository,
    private readonly getProduct: GetVeterinaryProductUseCase,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateVeterinaryProductDto,
  ): Promise<VeterinaryProduct> {
    const product = await this.getProduct.execute(id);
    const { isActive, ...changes } = dto;
    product.update(changes);
    if (isActive === true) product.activate();
    if (isActive === false) product.deactivate();
    if (dto.name !== undefined) {
      await assertNameAvailable(this.repository, product);
    }
    product.markUpdatedBy(actorId);
    await this.repository.save(product);
    return product;
  }
}

@Injectable()
export class DeleteVeterinaryProductUseCase {
  constructor(
    @Inject(VETERINARY_PRODUCT_REPOSITORY)
    private readonly repository: IVeterinaryProductRepository,
    private readonly getProduct: GetVeterinaryProductUseCase,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    await this.getProduct.execute(id);
    const usages = await this.repository.countUsages(id);
    if (usages > 0) {
      throw new ConflictException(
        `No se puede eliminar el producto: figura en ${usages} registro(s) sanitario(s). Desactívelo en su lugar.`,
      );
    }
    await this.repository.softDelete(id, actorId);
  }
}

async function assertNameAvailable(
  repository: IVeterinaryProductRepository,
  product: VeterinaryProduct,
) {
  const existing = await repository.findByName(product.getName());
  if (existing && existing.getId() !== product.getId()) {
    throw new ConflictException(
      `Ya existe el producto "${existing.getName()}"`,
    );
  }
}
