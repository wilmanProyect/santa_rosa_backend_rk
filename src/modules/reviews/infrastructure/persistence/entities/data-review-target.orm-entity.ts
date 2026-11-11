import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import { ReviewEntityType } from '../../../domain/review.model';
import { DataReviewOrmEntity } from './data-review.orm-entity';

/**
 * Registro (animal, parto o monta) al que se asocia un aviso. No tiene clave
 * foránea hacia el registro porque puede ser de tres tablas distintas.
 */
@Entity('data_review_targets')
@Index('IDX_data_review_targets_entity', ['entityType', 'entityId'])
@Index('UQ_data_review_targets', ['review', 'entityType', 'entityId'], {
  unique: true,
})
@Check('CHK_data_review_targets_type', sqlIn('entity_type', ReviewEntityType))
export class DataReviewTargetOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => DataReviewOrmEntity, (r) => r.targets, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'disable',
  })
  @JoinColumn({ name: 'review_id' })
  review: DataReviewOrmEntity;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: ReviewEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  role: string | null;

  @Column({ type: 'smallint' })
  position: number;
}
