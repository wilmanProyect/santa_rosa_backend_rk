import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { sqlIn } from '@shared/infrastructure/persistence/sql-in';
import {
  AdministrationRoute,
  DoseUnit,
  ProductCategory,
} from '../../../domain/enums/veterinary.enums';

@Entity('veterinary_products')
// Nombre único sin distinguir mayúsculas: índice por expresión (lower(name))
// creado a mano en la migración.
@Index('UQ_veterinary_products_name_active', { synchronize: false })
@Check('CHK_veterinary_products_category', sqlIn('category', ProductCategory))
@Check('CHK_veterinary_products_dose_unit', sqlIn('dose_unit', DoseUnit))
@Check(
  'CHK_veterinary_products_default_route',
  sqlIn('default_route', AdministrationRoute),
)
@Check('CHK_veterinary_products_species', `"for_sheep" OR "for_goats"`)
@Check(
  'CHK_veterinary_products_withdrawal',
  `"meat_withdrawal_days" BETWEEN 0 AND 365 AND ("milk_withdrawal_days" IS NULL OR "milk_withdrawal_days" BETWEEN 0 AND 365)`,
)
export class VeterinaryProductOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 30 })
  category: ProductCategory;

  @Column({
    name: 'active_ingredient',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  activeIngredient: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  concentration: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  presentation: string | null;

  @Column({ name: 'dose_unit', type: 'varchar', length: 10, nullable: true })
  doseUnit: DoseUnit | null;

  @Column({
    name: 'default_route',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  defaultRoute: AdministrationRoute | null;

  @Column({
    name: 'dosage_instructions',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  dosageInstructions: string | null;

  @Column({ name: 'for_sheep', default: true })
  forSheep: boolean;

  @Column({ name: 'for_goats', default: true })
  forGoats: boolean;

  @Column({ name: 'meat_withdrawal_days', type: 'int', default: 0 })
  meatWithdrawalDays: number;

  @Column({ name: 'milk_withdrawal_days', type: 'int', nullable: true })
  milkWithdrawalDays: number | null;

  @Column({ name: 'requires_prescription', default: false })
  requiresPrescription: boolean;

  @Column({ name: 'requires_refrigeration', default: false })
  requiresRefrigeration: boolean;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
