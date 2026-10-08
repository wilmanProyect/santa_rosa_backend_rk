import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesPermissionsModule } from '@modules/roles-permissions/roles-permissions.module';
import { AreasModule } from '@modules/areas/areas.module';
import { UserOrmEntity } from './infrastructure/persistence/entities/user.orm-entity';
import { UserPermissionOrmEntity } from './infrastructure/persistence/entities/user-permission.orm-entity';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { UserTypeormRepository } from './infrastructure/persistence/repositories/user.typeorm.repository';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.interface';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { UserUniquenessService } from './application/services/user-uniqueness.service';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { ChangeUserStatusUseCase } from './application/use-cases/change-user-status.use-case';
import { AssignRolesUseCase } from './application/use-cases/assign-roles.use-case';
import { AssignPermissionsUseCase } from './application/use-cases/assign-permissions.use-case';
import { ResetUserPasswordUseCase } from './application/use-cases/reset-user-password.use-case';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case';
import { UserController } from './infrastructure/controllers/user.controller';
import { InitialAdminSeeder } from './infrastructure/persistence/seeders/initial-admin.seeder';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity, UserPermissionOrmEntity]),
    RolesPermissionsModule,
    AreasModule,
  ],
  controllers: [UserController],
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: UserTypeormRepository,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasherAdapter,
    },
    UserUniquenessService,
    CreateUserUseCase,
    UpdateUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    ChangeUserStatusUseCase,
    AssignRolesUseCase,
    AssignPermissionsUseCase,
    ResetUserPasswordUseCase,
    DeleteUserUseCase,
    InitialAdminSeeder,
  ],
  exports: [USER_REPOSITORY, PASSWORD_HASHER, GetUserUseCase],
})
export class UsersModule {}
