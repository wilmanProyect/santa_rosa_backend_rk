import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';

@Entity('animal_colors')
// Índice por expresión (lower(name)): se crea a mano en la migración.
@Index('UQ_animal_colors_name_active', { synchronize: false })
export class AnimalColorOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 50 })
  name: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
