import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { numericTransformer } from '@shared/infrastructure/persistence/numeric.transformer';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import { WeighingType } from '../../../domain/models/animal-weighing.model';
import { AnimalOrmEntity } from './animal.orm-entity';

const ACTIVE = '"deleted_at" IS NULL';

@Entity('animal_weighings')
@Index('IDX_animal_weighings_animal_date', ['animal', 'weighedAt'])
@Index('IDX_animal_weighings_next', ['nextWeighingAt'], {
  where: `"next_weighing_at" IS NOT NULL AND ${ACTIVE}`,
})
// Un solo peso al nacer y un solo peso al destete por animal.
@Index('UQ_animal_weighings_birth', ['animal'], {
  unique: true,
  where: `"type" = 'BIRTH' AND ${ACTIVE}`,
})
@Index('UQ_animal_weighings_weaning', ['animal'], {
  unique: true,
  where: `"type" = 'WEANING' AND ${ACTIVE}`,
})
@Check('CHK_animal_weighings_type', sqlIn('type', WeighingType))
@Check('CHK_animal_weighings_weight', `"weight_kg" > 0`)
@Check(
  'CHK_animal_weighings_body_condition',
  `"body_condition_score" IS NULL OR ("body_condition_score" BETWEEN 1 AND 5 AND ("body_condition_score" * 2) = trunc("body_condition_score" * 2))`,
)
@Check(
  'CHK_animal_weighings_next',
  `"next_weighing_at" IS NULL OR "next_weighing_at" > "weighed_at"`,
)
export class AnimalWeighingOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => AnimalOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'animal_id' })
  animal: AnimalOrmEntity;

  @Column({ name: 'weighed_at', type: 'date' })
  weighedAt: string;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  weightKg: number;

  @Column({ type: 'varchar', length: 20 })
  type: WeighingType;

  @Column({
    name: 'body_condition_score',
    type: 'numeric',
    precision: 2,
    scale: 1,
    nullable: true,
    transformer: numericTransformer,
  })
  bodyConditionScore: number | null;

  @Column({ name: 'is_estimated', default: false })
  isEstimated: boolean;

  @Column({ name: 'next_weighing_at', type: 'date', nullable: true })
  nextWeighingAt: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;
}
