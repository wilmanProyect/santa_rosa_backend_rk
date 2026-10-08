import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PermissionSeeder } from '@modules/roles-permissions/infrastructure/persistence/seeders/permission.seeder';
import { USER_REPOSITORY } from '../../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../../domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '../../../domain/ports/password-hasher.interface';
import type { IPasswordHasher } from '../../../domain/ports/password-hasher.interface';
import { User } from '../../../domain/models/user.model';
import { Username } from '../../../domain/value-objects/username.vo';
import { Password } from '../../../domain/value-objects/password.vo';

/**
 * Datos iniciales al arrancar:
 *   1. Catálogo de permisos y rol Administrador (vía PermissionSeeder).
 *   2. Usuario administrador por defecto, solo si no existe ningún usuario
 *      activo con el rol Administrador. Debe cambiar la contraseña al ingresar.
 */
@Injectable()
export class InitialAdminSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitialAdminSeeder.name);

  constructor(
    private readonly permissionSeeder: PermissionSeeder,
    private readonly configService: ConfigService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  async onApplicationBootstrap() {
    const adminRole = await this.permissionSeeder.seed();

    if (
      (await this.userRepository.countActiveWithRole(adminRole.getId())) > 0
    ) {
      return;
    }

    const username = new Username(
      this.configService.get<string>('ADMIN_DEFAULT_USERNAME', 'admin'),
    );
    if (await this.userRepository.findByUsername(username.getValue())) {
      this.logger.warn(
        `No hay administradores activos y el usuario "${username.getValue()}" ya existe sin ese rol. Asígnele el rol manualmente.`,
      );
      return;
    }

    const plainPassword = this.configService.get<string>(
      'ADMIN_DEFAULT_PASSWORD',
      'Admin123',
    );
    const admin = User.create({
      firstName: 'Administrador',
      paternalLastName: 'del Sistema',
      maternalLastName: null,
      ciNumber: null,
      email: null,
      birthDate: null,
      phone: null,
      position: null,
      username,
      password: new Password(await this.passwordHasher.hash(plainPassword)),
      area: null,
      roles: [adminRole],
      createdBy: null,
      mustChangePassword: true,
      now: new Date(),
    });

    await this.userRepository.save(admin);
    this.logger.warn(
      `Usuario administrador creado: "${username.getValue()}". Cambie la contraseña en el primer inicio de sesión.`,
    );
  }
}
