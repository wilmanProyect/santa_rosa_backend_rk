import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { numericTransformer } from '@shared/infrastructure/persistence/numeric.transformer';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import { Sex } from '@modules/animals/domain/enums/animal.enums';
import { AnimalOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal.orm-entity';
import { BirthOrmEntity } from './birth.orm-entity';

/**
 * Crías de un parto. Las vivas enlazan al animal creado; las nacidas muertas
 * solo cuentan para los indicadores.
 */
@Entity('birth_offspring')
@Index('UQ_birth_offspring_position', ['birth', 'position'], { unique: true })
// Un animal nace en un solo parto.
@Index('UQ_birth_offspring_animal', ['animal'], {
  unique: true,
  where: `"animal_id" IS NOT NULL`,
})
@Check('CHK_birth_offspring_sex', sqlIn('sex', Sex))
@Check('CHK_birth_offspring_alive', `"born_alive" = ("animal_id" IS NOT NULL)`)
@Check(
  'CHK_birth_offspring_weight',
  `"birth_weight_kg" IS NULL OR "birth_weight_kg" > 0`,
)
@Check('CHK_birth_offspring_position', `"position" >= 1`)
export class BirthOffspringOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => BirthOrmEntity, (b) => b.offspring, {
    nullable: false,
    onDelete: 'CASCADE',
    orphanedRowAction: 'disable',
  })
  @JoinColumn({ name: 'birth_id' })
  birth: BirthOrmEntity;

  @Column({ type: 'smallint' })
  position: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sex: Sex | null;

  @Column({ name: 'born_alive' })
  bornAlive: boolean;

  @Column({
    name: 'birth_weight_kg',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  birthWeightKg: number | null;

  @ManyToOne(() => AnimalOrmEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'animal_id' })
  animal: AnimalOrmEntity | null;
}
