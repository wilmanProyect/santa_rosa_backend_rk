import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreasModule } from '@modules/areas/areas.module';
import { RoleOrmEntity } from './infrastructure/persistence/entities/role.orm-entity';
import { PermissionOrmEntity } from './infrastructure/persistence/entities/permission.orm-entity';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository.interface';
import { RoleTypeormRepository } from './infrastructure/persistence/repositories/role.typeorm.repository';
import { RoleLookupService } from './application/services/role-lookup.service';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case';
import { GetRoleUseCase } from './application/use-cases/get-role.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { RoleController } from './infrastructure/controllers/role.controller';
import { PermissionSeeder } from './infrastructure/persistence/seeders/permission.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([RoleOrmEntity, PermissionOrmEntity]),
    AreasModule,
  ],
  controllers: [RoleController],
  providers: [
    {
      provide: ROLE_REPOSITORY,
      useClass: RoleTypeormRepository,
    },
    RoleLookupService,
    CreateRoleUseCase,
    UpdateRoleUseCase,
    GetRoleUseCase,
    ListRolesUseCase,
    DeleteRoleUseCase,
    ListPermissionsUseCase,
    PermissionSeeder,
  ],
  exports: [ROLE_REPOSITORY, RoleLookupService, PermissionSeeder],
})
export class RolesPermissionsModule {}
