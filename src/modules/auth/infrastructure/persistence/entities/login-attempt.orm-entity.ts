import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserOrmEntity } from '@modules/users/infrastructure/persistence/entities/user.orm-entity';
import { LoginFailureReason } from '../../../domain/enums/auth.enums';

@Entity('login_attempts')
export class LoginAttemptOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index('IDX_login_attempts_user_id')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: UserOrmEntity | null;

  /** Usuario tal como se escribió en el login (aunque no exista). */
  @Column({ length: 100 })
  username: string;

  @Column()
  success: boolean;

  @Column({
    name: 'failure_reason',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  failureReason: LoginFailureReason | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Index('IDX_login_attempts_created_at')
  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
