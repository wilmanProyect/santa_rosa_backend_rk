import { Check, Column, Entity, Index, PrimaryColumn, Unique } from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { Species } from '../../../domain/enums/animal.enums';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';

@Entity('breeds')
// Nombre único por especie sin distinguir mayúsculas. Es un índice por expresión
// (lower(name)) que TypeORM no sabe comparar: se crea a mano en la migración.
@Index('UQ_breeds_species_name_active', { synchronize: false })
// Necesario para la FK compuesta animals(breed_id, species) → breeds(id, species),
// que garantiza en la BD que la raza de un animal sea de su misma especie.
@Unique('UQ_breeds_id_species', ['id', 'species'])
@Check('CHK_breeds_species', sqlIn('species', Species))
export class BreedOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  species: Species;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
