import {
  Column,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { AuditableOrmEntity } from '@shared/infrastructure/persistence/audit-columns';
import { RoleOrmEntity } from '@modules/roles-permissions/infrastructure/persistence/entities/role.orm-entity';
import { AreaOrmEntity } from '@modules/areas/infrastructure/persistence/entities/area.orm-entity';
import {
  InactiveReason,
  UserStatus,
} from '../../../domain/enums/user-status.enum';
import { UserPermissionOrmEntity } from './user-permission.orm-entity';

const ACTIVE_ONLY = '"deleted_at" IS NULL';

@Entity('users')
@Index('UQ_users_username_active', ['username'], {
  unique: true,
  where: ACTIVE_ONLY,
})
@Index('UQ_users_email_active', ['email'], { unique: true, where: ACTIVE_ONLY })
@Index('UQ_users_ci_number_active', ['ciNumber'], {
  unique: true,
  where: ACTIVE_ONLY,
})
export class UserOrmEntity extends AuditableOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'paternal_last_name', length: 100 })
  paternalLastName: string;

  @Column({
    name: 'maternal_last_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  maternalLastName: string | null;

  /** Nulo solo para cuentas de sistema (p. ej. el admin inicial). */
  @Column({ name: 'ci_number', type: 'varchar', length: 20, nullable: true })
  ciNumber: string | null;

  @Column({ length: 30 })
  username: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  /** Cargo del trabajador. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string | null;

  @ManyToOne(() => AreaOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'area_id' })
  area: AreaOrmEntity | null;

  @Column({ type: 'varchar', length: 20, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({
    name: 'inactive_reason',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  inactiveReason: InactiveReason | null;

  @Column({ name: 'inactive_date', type: 'date', nullable: true })
  inactiveDate: string | null;

  @Column({
    name: 'inactive_notes',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  inactiveNotes: string | null;

  @Column({ name: 'must_change_password', default: false })
  mustChangePassword: boolean;

  @Column({ name: 'password_changed_at', type: 'timestamptz', nullable: true })
  passwordChangedAt: Date | null;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @ManyToMany(() => RoleOrmEntity)
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: RoleOrmEntity[];

  @OneToMany(() => UserPermissionOrmEntity, (override) => override.user, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  permissionOverrides: UserPermissionOrmEntity[];
}
