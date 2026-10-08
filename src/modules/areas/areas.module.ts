import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaOrmEntity } from './infrastructure/persistence/entities/area.orm-entity';
import { AREA_REPOSITORY } from './domain/repositories/area.repository.interface';
import { AreaTypeormRepository } from './infrastructure/persistence/repositories/area.typeorm.repository';
import { CreateAreaUseCase } from './application/use-cases/create-area.use-case';
import { UpdateAreaUseCase } from './application/use-cases/update-area.use-case';
import { GetAreaUseCase } from './application/use-cases/get-area.use-case';
import { ListAreasUseCase } from './application/use-cases/list-areas.use-case';
import { DeleteAreaUseCase } from './application/use-cases/delete-area.use-case';
import { AreaController } from './infrastructure/controllers/area.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AreaOrmEntity])],
  controllers: [AreaController],
  providers: [
    {
      provide: AREA_REPOSITORY,
      useClass: AreaTypeormRepository,
    },
    CreateAreaUseCase,
    UpdateAreaUseCase,
    GetAreaUseCase,
    ListAreasUseCase,
    DeleteAreaUseCase,
  ],
  exports: [AREA_REPOSITORY, GetAreaUseCase],
})
export class AreasModule {}
