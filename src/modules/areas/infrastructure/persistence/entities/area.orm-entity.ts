import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';

@Entity('areas')
@Index('UQ_areas_name_active', ['name'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class AreaOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
