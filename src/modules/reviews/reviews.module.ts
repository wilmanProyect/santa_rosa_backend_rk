import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataReviewOrmEntity } from './infrastructure/persistence/entities/data-review.orm-entity';
import { DataReviewTargetOrmEntity } from './infrastructure/persistence/entities/data-review-target.orm-entity';
import { REVIEW_REPOSITORY } from './domain/review.repository.interface';
import { ReviewTypeormRepository } from './infrastructure/persistence/review.typeorm.repository';
import { ReviewsService } from './application/reviews.service';
import { ReviewsController } from './infrastructure/reviews.controller';

/**
 * Avisos de revisión de datos: problemas detectados (por ejemplo, al cruzar una
 * planilla con el sistema) que se muestran como un aviso en la ficha de cada
 * animal, parto o monta afectados hasta que el personal los corrige.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DataReviewOrmEntity, DataReviewTargetOrmEntity]),
  ],
  controllers: [ReviewsController],
  providers: [
    { provide: REVIEW_REPOSITORY, useClass: ReviewTypeormRepository },
    ReviewsService,
  ],
})
export class ReviewsModule {}
