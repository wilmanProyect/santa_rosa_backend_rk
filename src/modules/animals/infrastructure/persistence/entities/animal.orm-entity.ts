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
  AnimalStatus,
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '../../../domain/enums/animal.enums';
import { BreedOrmEntity } from './breed.orm-entity';
import { AnimalColorOrmEntity } from './animal-color.orm-entity';

const ALIVE = `'${AnimalStatus.ALIVE}'`;
const BORN_ON_FARM = `'${EntryOrigin.BORN_ON_FARM}'`;

@Entity('animals')
// Arete y registro ABSID son únicos DENTRO DE CADA ESPECIE (ovinos y caprinos
// tienen numeración y registro propios), salvo en los animales marcados como
// caso especial (identifier_exception), que existen así y no se corrigen.
// El arete es una numeración propia de cada cabaña: no se compara con los externos.
@Index('UQ_animals_ear_tag_active', ['species', 'earTag'], {
  unique: true,
  where:
    '"deleted_at" IS NULL AND NOT "is_external" AND NOT "identifier_exception"',
})
@Index('UQ_animals_absid_registry_active', ['species', 'absidRegistry'], {
  unique: true,
  where: '"deleted_at" IS NULL AND NOT "identifier_exception"',
})
// La misma combinación arete + ABSID no se repite ni como caso especial.
@Index(
  'UQ_animals_ear_tag_absid_registry_active',
  ['species', 'earTag', 'absidRegistry'],
  {
    unique: true,
    where: '"deleted_at" IS NULL',
  },
)
@Index('IDX_animals_ear_tag', ['earTag'])
@Index('IDX_animals_absid_registry', ['absidRegistry'])
@Index('IDX_animals_dam_id', ['dam'])
@Index('IDX_animals_sire_id', ['sire'])
@Index('IDX_animals_breed', ['breed'])
@Index('IDX_animals_color_id', ['color'])
@Index('IDX_animals_inventory', ['isExternal', 'status', 'species'])
// Valores permitidos de las columnas tipo enum
@Check('CHK_animals_species', sqlIn('species', Species))
@Check('CHK_animals_sex', sqlIn('sex', Sex))
@Check('CHK_animals_status', sqlIn('status', AnimalStatus))
@Check('CHK_animals_entry_origin', sqlIn('entry_origin', EntryOrigin))
@Check(
  'CHK_animals_genetic_category',
  sqlIn('genetic_category', GeneticCategory),
)
// Animales de la cabaña: origen obligatorio, y arete salvo en un caso especial
@Check(
  'CHK_animals_internal_required',
  `"is_external" OR ("entry_origin" IS NOT NULL AND ("ear_tag" IS NOT NULL OR "identifier_exception"))`,
)
// Animales externos: identificables, sin ingreso a la cabaña y fuera del inventario
@Check(
  'CHK_animals_external',
  `NOT "is_external" OR ("entry_origin" IS NULL AND "entry_date" IS NULL AND "status" = ${ALIVE} AND COALESCE("ear_tag", "name", "absid_registry", "external_registry") IS NOT NULL)`,
)
@Check(
  'CHK_animals_entry',
  `"entry_origin" IS NULL OR ("entry_origin" = ${BORN_ON_FARM} AND "birth_date" IS NOT NULL AND "entry_date" IS NULL AND "source_farm" IS NULL) OR "entry_origin" <> ${BORN_ON_FARM}`,
)
@Check(
  'CHK_animals_status_fields',
  // La API exige la fecha al registrar una salida; nula solo en datos históricos.
  `"status" <> ${ALIVE} OR ("status_date" IS NULL AND "status_reason" IS NULL)`,
)
@Check(
  'CHK_animals_dates',
  `("entry_date" IS NULL OR "birth_date" IS NULL OR "entry_date" >= "birth_date") AND ("status_date" IS NULL OR "birth_date" IS NULL OR "status_date" >= "birth_date") AND ("status_date" IS NULL OR "entry_date" IS NULL OR "status_date" >= "entry_date")`,
)
@Check('CHK_animals_parents', `"dam_id" <> "id" AND "sire_id" <> "id"`)
@Check(
  'CHK_animals_certificate_file',
  `num_nonnulls("certificate_file_key", "certificate_file_name", "certificate_file_mime_type", "certificate_file_size", "certificate_file_uploaded_at") IN (0, 5)`,
)
@Check(
  'CHK_animals_genetic_category_confirmed',
  `NOT "genetic_category_confirmed" OR "genetic_category" IS NOT NULL`,
)
@Check(
  'CHK_animals_identifier_exception',
  `("identifier_exception" AND "identifier_exception_reason" IS NOT NULL) OR (NOT "identifier_exception" AND "identifier_exception_reason" IS NULL)`,
)
export class AnimalOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'is_external', default: false })
  isExternal: boolean;

  /** Arete. Nulo en externos y en casos especiales sin arete registrado. */
  @Column({ name: 'ear_tag', type: 'varchar', length: 30, nullable: true })
  earTag: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  /** También forma parte de la FK compuesta hacia breeds. */
  @Column({ type: 'varchar', length: 10 })
  species: Species;

  @ManyToOne(() => BreedOrmEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn([
    { name: 'breed_id', referencedColumnName: 'id' },
    { name: 'species', referencedColumnName: 'species' },
  ])
  breed: BreedOrmEntity;

  @Column({ type: 'varchar', length: 10 })
  sex: Sex;

  @ManyToOne(() => AnimalColorOrmEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'color_id' })
  color: AnimalColorOrmEntity | null;

  @Column({
    name: 'genetic_category',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  geneticCategory: GeneticCategory | null;

  /** false: categoría esperada (calculada al nacer), pendiente de confirmar por ABSID. */
  @Column({ name: 'genetic_category_confirmed', default: false })
  geneticCategoryConfirmed: boolean;

  @Column({
    name: 'absid_registry',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  absidRegistry: string | null;

  @Column({
    name: 'absid_certificate_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  absidCertificateCode: string | null;

  /** Registro en otra entidad o código del reproductor en el centro de semen. */
  @Column({
    name: 'external_registry',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalRegistry: string | null;

  /** Caso especial: se permite repetir el arete o el registro ABSID. */
  @Column({ name: 'identifier_exception', default: false })
  identifierException: boolean;

  @Column({
    name: 'identifier_exception_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  identifierExceptionReason: string | null;

  // ---------- Archivo escaneado del certificado ABSID ----------

  @Column({
    name: 'certificate_file_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  certificateFileKey: string | null;

  @Column({
    name: 'certificate_file_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  certificateFileName: string | null;

  @Column({
    name: 'certificate_file_mime_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  certificateFileMimeType: string | null;

  @Column({ name: 'certificate_file_size', type: 'int', nullable: true })
  certificateFileSize: number | null;

  @Column({
    name: 'certificate_file_uploaded_at',
    type: 'timestamptz',
    nullable: true,
  })
  certificateFileUploadedAt: Date | null;

  // ---------- Genealogía ----------

  @ManyToOne(() => AnimalOrmEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dam_id' })
  dam: AnimalOrmEntity | null;

  @ManyToOne(() => AnimalOrmEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sire_id' })
  sire: AnimalOrmEntity | null;

  // ---------- Nacimiento ----------

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  // ---------- Ingreso a la cabaña ----------

  /** Nulo solo en animales externos. */
  @Column({ name: 'entry_origin', type: 'varchar', length: 20, nullable: true })
  entryOrigin: EntryOrigin | null;

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: string | null;

  @Column({ name: 'source_farm', type: 'varchar', length: 150, nullable: true })
  sourceFarm: string | null;

  // ---------- Estado ----------

  @Column({ type: 'varchar', length: 20, default: AnimalStatus.ALIVE })
  status: AnimalStatus;

  @Column({ name: 'status_date', type: 'date', nullable: true })
  statusDate: string | null;

  @Column({
    name: 'status_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  statusReason: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;
}
