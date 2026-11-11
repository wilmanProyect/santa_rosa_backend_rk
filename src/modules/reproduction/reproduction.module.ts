import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnimalsModule } from '@modules/animals/animals.module';
import { BreedingServiceOrmEntity } from './infrastructure/persistence/entities/breeding-service.orm-entity';
import { PregnancyCheckOrmEntity } from './infrastructure/persistence/entities/pregnancy-check.orm-entity';
import { BirthOrmEntity } from './infrastructure/persistence/entities/birth.orm-entity';
import { BirthOffspringOrmEntity } from './infrastructure/persistence/entities/birth-offspring.orm-entity';
import {
  BIRTH_REPOSITORY,
  BREEDING_SERVICE_REPOSITORY,
  REPRODUCTION_QUERY_REPOSITORY,
} from './domain/repositories/reproduction.repository.interface';
import { BreedingServiceTypeormRepository } from './infrastructure/persistence/repositories/breeding-service.typeorm.repository';
import { BirthTypeormRepository } from './infrastructure/persistence/repositories/birth.typeorm.repository';
import { ReproductionQueryTypeormRepository } from './infrastructure/persistence/repositories/reproduction-query.typeorm.repository';
import { BreedingEvaluationService } from './application/services/breeding-evaluation.service';
import { BreedingServicesService } from './application/use-cases/breeding-services.service';
import { BirthsService } from './application/use-cases/births.service';
import { ReproductionReportsService } from './application/use-cases/reproduction-reports.service';
import { BreedingController } from './infrastructure/controllers/breeding.controller';
import { ReminderController } from './infrastructure/controllers/reminder.controller';

/**
 * Reproducción: montas (dirigidas o inseminación), diagnósticos de preñez,
 * abortos y partos (simples, gemelos, trillizos). Bloquea las montas entre
 * parientes hasta 3 generaciones y calcula la categoría genética esperada de
 * las crías. El parto crea las crías en el módulo de animales.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BreedingServiceOrmEntity,
      PregnancyCheckOrmEntity,
      BirthOrmEntity,
      BirthOffspringOrmEntity,
    ]),
    AnimalsModule,
  ],
  controllers: [BreedingController, ReminderController],
  providers: [
    {
      provide: BREEDING_SERVICE_REPOSITORY,
      useClass: BreedingServiceTypeormRepository,
    },
    { provide: BIRTH_REPOSITORY, useClass: BirthTypeormRepository },
    {
      provide: REPRODUCTION_QUERY_REPOSITORY,
      useClass: ReproductionQueryTypeormRepository,
    },
    BreedingEvaluationService,
    BreedingServicesService,
    BirthsService,
    ReproductionReportsService,
  ],
})
export class ReproductionModule {}
