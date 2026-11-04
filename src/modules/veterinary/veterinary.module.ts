import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VeterinaryProductOrmEntity } from './infrastructure/persistence/entities/veterinary-product.orm-entity';
import { VETERINARY_PRODUCT_REPOSITORY } from './domain/repositories/veterinary-product.repository.interface';
import { VeterinaryProductTypeormRepository } from './infrastructure/persistence/repositories/veterinary-product.typeorm.repository';
import {
  CreateVeterinaryProductUseCase,
  DeleteVeterinaryProductUseCase,
  GetVeterinaryProductUseCase,
  ListVeterinaryProductsUseCase,
  UpdateVeterinaryProductUseCase,
} from './application/use-cases/veterinary-product.use-cases';
import { VeterinaryProductController } from './infrastructure/controllers/veterinary-product.controller';

/**
 * Veterinaria: por ahora el catálogo de productos. El inventario (lotes,
 * vencimientos, stock y movimientos) se agregará en este mismo módulo.
 */
@Module({
  imports: [TypeOrmModule.forFeature([VeterinaryProductOrmEntity])],
  controllers: [VeterinaryProductController],
  providers: [
    {
      provide: VETERINARY_PRODUCT_REPOSITORY,
      useClass: VeterinaryProductTypeormRepository,
    },
    GetVeterinaryProductUseCase,
    ListVeterinaryProductsUseCase,
    CreateVeterinaryProductUseCase,
    UpdateVeterinaryProductUseCase,
    DeleteVeterinaryProductUseCase,
  ],
  exports: [VETERINARY_PRODUCT_REPOSITORY, GetVeterinaryProductUseCase],
})
export class VeterinaryModule {}
