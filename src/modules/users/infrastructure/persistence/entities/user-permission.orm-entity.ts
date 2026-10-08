import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { PermissionOrmEntity } from '@modules/roles-permissions/infrastructure/persistence/entities/permission.orm-entity';
import { PermissionEffect } from '../../../domain/enums/permission-effect.enum';
import { UserOrmEntity } from './user.orm-entity';

/** Ajustes individuales de permisos (otorgar/denegar) de un usuario. */
@Entity('user_permissions')
export class UserPermissionOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @Column({ type: 'varchar', length: 10 })
  effect: PermissionEffect;

  @ManyToOne(() => UserOrmEntity, (user) => user.permissionOverrides, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: Relation<UserOrmEntity>;

  @ManyToOne(() => PermissionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionOrmEntity;
}
