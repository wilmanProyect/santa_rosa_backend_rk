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
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import { TakenAtSource } from '../../../domain/models/animal-photo.model';
import { AnimalOrmEntity } from './animal.orm-entity';

const ACTIVE = '"deleted_at" IS NULL';

@Entity('animal_photos')
@Index('IDX_animal_photos_animal_id', ['animal', 'uploadedAt'])
@Index('IDX_animal_photos_uploaded_by', ['uploadedBy'])
// Una sola foto principal por animal.
@Index('UQ_animal_photos_primary', ['animal'], {
  unique: true,
  where: `"is_primary" AND ${ACTIVE}`,
})
// La misma imagen no se sube dos veces al mismo animal.
@Index('UQ_animal_photos_animal_checksum', ['animal', 'checksumSha256'], {
  unique: true,
  where: ACTIVE,
})
@Check(
  'CHK_animal_photos_mime_type',
  `"mime_type" IN ('image/jpeg', 'image/png', 'image/webp')`,
)
@Check(
  'CHK_animal_photos_taken_at_source',
  sqlIn('taken_at_source', TakenAtSource),
)
@Check(
  'CHK_animal_photos_taken_at',
  `("taken_at" IS NULL) = ("taken_at_source" IS NULL)`,
)
@Check(
  'CHK_animal_photos_file',
  `"size_bytes" > 0 AND "width" > 0 AND "height" > 0 AND "checksum_sha256" ~ '^[0-9a-f]{64}$'`,
)
export class AnimalPhotoOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @ManyToOne(() => AnimalOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'animal_id' })
  animal: AnimalOrmEntity;

  // ---------- Archivo en el almacenamiento (Garage) ----------

  @Column({ name: 'object_key', type: 'varchar', length: 255, unique: true })
  objectKey: string;

  @Column({ name: 'thumbnail_key', type: 'varchar', length: 255, unique: true })
  thumbnailKey: string;

  @Column({ name: 'original_file_name', type: 'varchar', length: 255 })
  originalFileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 50 })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @Column({ type: 'int' })
  width: number;

  @Column({ type: 'int' })
  height: number;

  @Column({ name: 'checksum_sha256', type: 'char', length: 64 })
  checksumSha256: string;

  // ---------- Datos de la foto ----------

  @Column({ name: 'taken_at', type: 'date', nullable: true })
  takenAt: string | null;

  @Column({
    name: 'taken_at_source',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  takenAtSource: TakenAtSource | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean;

  // ---------- Subida ----------

  @ManyToOne(() => UserOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedBy: UserOrmEntity;

  @Column({ name: 'uploaded_at', type: 'timestamptz' })
  uploadedAt: Date;
}
