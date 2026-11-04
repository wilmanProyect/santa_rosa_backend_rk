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
import {
  AdministrationRoute,
  DoseUnit,
} from '@modules/veterinary/domain/enums/veterinary.enums';
import { VeterinaryProductOrmEntity } from '@modules/veterinary/infrastructure/persistence/entities/veterinary-product.orm-entity';
import { HealthEventType } from '../../../domain/models/health-record.model';
import { AnimalOrmEntity } from './animal.orm-entity';

const ACTIVE = '"deleted_at" IS NULL';

@Entity('health_records')
@Index('IDX_health_records_animal_date', ['animal', 'appliedAt'])
@Index('IDX_health_records_applied_at', ['appliedAt'])
@Index('IDX_health_records_product', ['product'])
@Index('IDX_health_records_next_dose', ['nextDoseAt'], {
  where: `"next_dose_at" IS NOT NULL AND ${ACTIVE}`,
})
@Check('CHK_health_records_type', sqlIn('type', HealthEventType))
@Check('CHK_health_records_dose_unit', sqlIn('dose_unit', DoseUnit))
@Check('CHK_health_records_route', sqlIn('route', AdministrationRoute))
// Limpieza de corral: evento general sin animal; el resto, siempre con animal.
@Check(
  'CHK_health_records_animal',
  `("type" = 'CORRAL_CLEANING') = ("animal_id" IS NULL)`,
)
@Check(
  'CHK_health_records_dose',
  `("dose_quantity" IS NULL) = ("dose_unit" IS NULL) AND ("dose_quantity" IS NULL OR "dose_quantity" > 0)`,
)
@Check(
  'CHK_health_records_withdrawal',
  `("product_id" IS NULL AND "meat_withdrawal_days" = 0 AND "milk_withdrawal_days" IS NULL) OR ("product_id" IS NOT NULL AND "meat_withdrawal_days" >= 0 AND ("milk_withdrawal_days" IS NULL OR "milk_withdrawal_days" >= 0))`,
)
@Check(
  'CHK_health_records_next_dose',
  `"next_dose_at" IS NULL OR "next_dose_at" > "applied_at"`,
)
@Check('CHK_health_records_cost', `"cost" IS NULL OR "cost" >= 0`)
export class HealthRecordOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => AnimalOrmEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'animal_id' })
  animal: AnimalOrmEntity | null;

  @Column({ type: 'varchar', length: 30 })
  type: HealthEventType;

  @Column({ name: 'applied_at', type: 'date' })
  appliedAt: string;

  @Column({ name: 'is_date_estimated', default: false })
  isDateEstimated: boolean;

  @ManyToOne(() => VeterinaryProductOrmEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product: VeterinaryProductOrmEntity | null;

  /** Días de retiro del producto al momento de aplicarlo (no cambian si se edita el catálogo). */
  @Column({ name: 'meat_withdrawal_days', type: 'int', default: 0 })
  meatWithdrawalDays: number;

  @Column({ name: 'milk_withdrawal_days', type: 'int', nullable: true })
  milkWithdrawalDays: number | null;

  @Column({
    name: 'product_batch',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  productBatch: string | null;

  @Column({
    name: 'dose_quantity',
    type: 'numeric',
    precision: 8,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  doseQuantity: number | null;

  @Column({ name: 'dose_unit', type: 'varchar', length: 10, nullable: true })
  doseUnit: DoseUnit | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  route: AdministrationRoute | null;

  @Column({
    name: 'target_condition',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  targetCondition: string | null;

  @Column({ name: 'applied_by', type: 'varchar', length: 150, nullable: true })
  appliedBy: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ name: 'next_dose_at', type: 'date', nullable: true })
  nextDoseAt: string | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  cost: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;
}
