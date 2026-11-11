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
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import { Species } from '@modules/animals/domain/enums/animal.enums';
import { AnimalOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal.orm-entity';
import { BirthAssistance } from '../../../domain/enums/reproduction.enums';
import { BreedingServiceOrmEntity } from './breeding-service.orm-entity';
import { BirthOffspringOrmEntity } from './birth-offspring.orm-entity';

@Entity('births')
@Index('IDX_births_dam_date', ['dam', 'birthDate'])
@Index('IDX_births_sire', ['sire'])
@Index('IDX_births_date', ['birthDate'])
// Un solo parto por monta.
@Index('UQ_births_service', ['service'], {
  unique: true,
  where: `"service_id" IS NOT NULL AND "deleted_at" IS NULL`,
})
@Check('CHK_births_species', sqlIn('species', Species))
@Check('CHK_births_assistance', sqlIn('assistance', BirthAssistance))
@Check('CHK_births_parents', `"sire_id" IS NULL OR "dam_id" <> "sire_id"`)
export class BirthOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => BreedingServiceOrmEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'service_id' })
  service: BreedingServiceOrmEntity | null;

  @ManyToOne(() => AnimalOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dam_id' })
  dam: AnimalOrmEntity;

  @ManyToOne(() => AnimalOrmEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sire_id' })
  sire: AnimalOrmEntity | null;

  @Column({ type: 'varchar', length: 10 })
  species: Species;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  assistance: BirthAssistance | null;

  @Column({ name: 'is_historical', default: false })
  isHistorical: boolean;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;

  @OneToMany(() => BirthOffspringOrmEntity, (o) => o.birth, {
    cascade: ['insert', 'update'],
  })
  offspring: BirthOffspringOrmEntity[];
}
