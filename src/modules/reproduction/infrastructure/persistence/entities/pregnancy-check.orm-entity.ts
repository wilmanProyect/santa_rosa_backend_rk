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
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import {
  MAX_LITTER_SIZE,
  PregnancyCheckMethod,
  PregnancyCheckResult,
} from '../../../domain/enums/reproduction.enums';
import { BreedingServiceOrmEntity } from './breeding-service.orm-entity';

@Entity('pregnancy_checks')
@Index('IDX_pregnancy_checks_service', ['service', 'checkedAt'])
@Check('CHK_pregnancy_checks_method', sqlIn('method', PregnancyCheckMethod))
@Check('CHK_pregnancy_checks_result', sqlIn('result', PregnancyCheckResult))
@Check(
  'CHK_pregnancy_checks_fetus_count',
  `"fetus_count" IS NULL OR ("result" = 'PREGNANT' AND "fetus_count" BETWEEN 1 AND ${MAX_LITTER_SIZE})`,
)
export class PregnancyCheckOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => BreedingServiceOrmEntity, (service) => service.checks, {
    nullable: false,
    onDelete: 'RESTRICT',
    // Los diagnósticos se eliminan con borrado lógico, nunca por omisión.
    orphanedRowAction: 'disable',
  })
  @JoinColumn({ name: 'service_id' })
  service: BreedingServiceOrmEntity;

  @Column({ name: 'checked_at', type: 'date' })
  checkedAt: string;

  @Column({ type: 'varchar', length: 20 })
  method: PregnancyCheckMethod;

  @Column({ type: 'varchar', length: 20 })
  result: PregnancyCheckResult;

  @Column({ name: 'fetus_count', type: 'smallint', nullable: true })
  fetusCount: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;
}
