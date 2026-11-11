import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import { GeneticCategory } from '../../../domain/enums/animal.enums';
import { GeneticCategoryChangeKind } from '../../../domain/models/genetic-category-change';
import { AnimalOrmEntity } from './animal.orm-entity';

/** Historial de categoría genética: solo se agregan filas, nunca se editan. */
@Entity('genetic_category_changes')
@Index('IDX_genetic_category_changes_animal', ['animal', 'changedOn'])
@Check(
  'CHK_genetic_category_changes_kind',
  sqlIn('kind', GeneticCategoryChangeKind),
)
@Check(
  'CHK_genetic_category_changes_from',
  sqlIn('from_category', GeneticCategory),
)
@Check('CHK_genetic_category_changes_to', sqlIn('to_category', GeneticCategory))
export class GeneticCategoryChangeOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => AnimalOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'animal_id' })
  animal: AnimalOrmEntity;

  @Column({
    name: 'from_category',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  fromCategory: GeneticCategory | null;

  @Column({ name: 'to_category', type: 'varchar', length: 20, nullable: true })
  toCategory: GeneticCategory | null;

  @Column({ type: 'varchar', length: 20 })
  kind: GeneticCategoryChangeKind;

  @Column({ name: 'changed_on', type: 'date' })
  changedOn: string;

  @Column({
    name: 'absid_certificate_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  absidCertificateCode: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;
}
