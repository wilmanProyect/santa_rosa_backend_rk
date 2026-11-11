import {
  Check,
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import { ReviewCategory, ReviewStatus } from '../../../domain/review.model';
import { DataReviewTargetOrmEntity } from './data-review-target.orm-entity';

@Entity('data_reviews')
@Index('IDX_data_reviews_status', ['status', 'createdAt'])
@Check('CHK_data_reviews_status', sqlIn('status', ReviewStatus))
@Check('CHK_data_reviews_category', sqlIn('category', ReviewCategory))
@Check(
  'CHK_data_reviews_resolution',
  `("status" = 'RESOLVED') = ("resolved_at" IS NOT NULL AND "resolution" IS NOT NULL)`,
)
export class DataReviewOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  category: ReviewCategory;

  @Column({ type: 'varchar', length: 1000 })
  message: string;

  /** De dónde salió el aviso, por ejemplo "Planilla de montas". */
  @Column({ type: 'varchar', length: 150, nullable: true })
  source: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: ReviewStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  resolution: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string | null;

  @OneToMany(() => DataReviewTargetOrmEntity, (t) => t.review, {
    cascade: ['insert'],
  })
  targets: DataReviewTargetOrmEntity[];
}
