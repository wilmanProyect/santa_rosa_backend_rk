import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from './infrastructure/persistence/entities/user.orm-entity';
import { USER_REPOSITORY } from './domain/repositories/user.repository.interface';
import { UserTypeormRepository } from './infrastructure/persistence/repositories/user.typeorm.repository';
import { PASSWORD_HASHER } from './domain/ports/password-hasher.interface';
import { BcryptPasswordHasherAdapter } from './infrastructure/adapters/bcrypt-password-hasher.adapter';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { AssignRolesUseCase } from './application/use-cases/assign-roles.use-case';
import { UserController } from './infrastructure/controllers/user.controller';
import { RolesPermissionsModule } from '@modules/roles-permissions/roles-permissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserOrmEntity]),
    RolesPermissionsModule,
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
    CreateUserUseCase,
    ListUsersUseCase,
    AssignRolesUseCase,
  ],
  exports: [
    USER_REPOSITORY,
  ],
})
export class UsersModule {}
