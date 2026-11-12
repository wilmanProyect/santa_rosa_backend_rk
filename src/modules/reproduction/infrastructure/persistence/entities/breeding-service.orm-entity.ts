import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { numericTransformer } from '@shared/infrastructure/persistence/numeric.transformer';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import {
  GeneticCategory,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import { AnimalOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal.orm-entity';
import type { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import {
  ServiceStatus,
  ServiceType,
} from '../../../domain/enums/reproduction.enums';
import { PregnancyCheckOrmEntity } from './pregnancy-check.orm-entity';

@Entity('breeding_services')
@Index('IDX_breeding_services_dam_date', ['dam', 'serviceDate'])
@Index('IDX_breeding_services_sire', ['sire'])
@Index('IDX_breeding_services_status', ['status', 'expectedBirthDate'])
// Una sola monta abierta (sin diagnóstico o preñada) por hembra.
@Index('UQ_breeding_services_open_dam', ['dam'], {
  unique: true,
  where: `"status" IN ('PENDING', 'PREGNANT') AND "deleted_at" IS NULL`,
})
@Check('CHK_breeding_services_type', sqlIn('type', ServiceType))
@Check('CHK_breeding_services_status', sqlIn('status', ServiceStatus))
@Check('CHK_breeding_services_species', sqlIn('species', Species))
@Check(
  'CHK_breeding_services_category',
  sqlIn('expected_offspring_category', GeneticCategory),
)
@Check('CHK_breeding_services_pair', `"dam_id" <> "sire_id"`)
@Check(
  'CHK_breeding_services_dates',
  `"expected_birth_date" > "service_date" AND ("abortion_date" IS NULL OR "abortion_date" >= "service_date")`,
)
@Check(
  'CHK_breeding_services_exit',
  `"exit_date" IS NULL OR "exit_date" >= "service_date"`,
)
@Check(
  'CHK_breeding_services_abortion',
  `("status" = 'ABORTED') = ("abortion_date" IS NOT NULL)`,
)
@Check(
  'CHK_breeding_services_override',
  `num_nonnulls("kinship_override_reason", "kinship_override_by", "kinship_override_at") IN (0, 3)`,
)
@Check(
  'CHK_breeding_services_straw',
  `"straw_code" IS NULL OR "type" = 'ARTIFICIAL_INSEMINATION'`,
)
@Check(
  'CHK_breeding_services_inbreeding',
  `"inbreeding_coefficient" BETWEEN 0 AND 1`,
)
export class BreedingServiceOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => AnimalOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dam_id' })
  dam: AnimalOrmEntity;

  @ManyToOne(() => AnimalOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sire_id' })
  sire: AnimalOrmEntity;

  /** Usuario de created_by; no es columna: lo carga el repositorio al leer. */
  creator?: UserOrmEntity | null;

  @Column({ type: 'varchar', length: 10 })
  species: Species;

  @Column({ type: 'varchar', length: 30 })
  type: ServiceType;

  /** Fecha de ingreso. */
  @Column({ name: 'service_date', type: 'date' })
  serviceDate: string;

  @Column({ name: 'exit_date', type: 'date', nullable: true })
  exitDate: string | null;

  @Column({ name: 'straw_code', type: 'varchar', length: 50, nullable: true })
  strawCode: string | null;

  @Column({ name: 'expected_birth_date', type: 'date' })
  expectedBirthDate: string;

  @Column({ type: 'varchar', length: 20 })
  status: ServiceStatus;

  @Column({
    name: 'inbreeding_coefficient',
    type: 'numeric',
    precision: 6,
    scale: 5,
    default: 0,
    transformer: numericTransformer,
  })
  inbreedingCoefficient: number;

  @Column({
    name: 'kinship_override_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  kinshipOverrideReason: string | null;

  @Column({ name: 'kinship_override_by', type: 'uuid', nullable: true })
  kinshipOverrideBy: string | null;

  @Column({
    name: 'kinship_override_at',
    type: 'timestamptz',
    nullable: true,
  })
  kinshipOverrideAt: Date | null;

  @Column({
    name: 'expected_offspring_category',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  expectedOffspringCategory: GeneticCategory | null;

  @Column({ name: 'abortion_date', type: 'date', nullable: true })
  abortionDate: string | null;

  @Column({
    name: 'abortion_cause',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  abortionCause: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;

  @OneToMany(() => PregnancyCheckOrmEntity, (check) => check.service, {
    cascade: ['insert', 'update'],
  })
  checks: PregnancyCheckOrmEntity[];
}
