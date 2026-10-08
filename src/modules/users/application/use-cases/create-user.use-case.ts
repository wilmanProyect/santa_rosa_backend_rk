import { Inject, Injectable } from '@nestjs/common';
import { GetAreaUseCase } from '@modules/areas/application/use-cases/get-area.use-case';
import { RoleLookupService } from '@modules/roles-permissions/application/services/role-lookup.service';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '../../domain/ports/password-hasher.interface';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.interface';
import { User } from '../../domain/models/user.model';
import { Email } from '../../domain/value-objects/email.vo';
import { Password } from '../../domain/value-objects/password.vo';
import { Username } from '../../domain/value-objects/username.vo';
import { assertPasswordPolicy } from '../../domain/services/password-policy';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserUniquenessService } from '../services/user-uniqueness.service';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    private readonly roleLookup: RoleLookupService,
    private readonly getAreaUseCase: GetAreaUseCase,
    private readonly uniqueness: UserUniquenessService,
  ) {}

  async execute(actorId: string, dto: CreateUserDto): Promise<User> {
    const username = new Username(dto.username);
    const email = new Email(dto.email);
    const ciNumber = dto.ciNumber.trim().toUpperCase();
    assertPasswordPolicy(dto.password);

    await this.uniqueness.assertAvailable({
      username: username.getValue(),
      email: email.getValue(),
      ciNumber,
    });

    const area = dto.areaId
      ? await this.getAreaUseCase.executeActive(dto.areaId)
      : null;
    const roles = await this.roleLookup.resolveAssignableRoles(
      dto.roleIds ?? [],
    );
    const password = new Password(await this.passwordHasher.hash(dto.password));

    const user = User.create({
      firstName: dto.firstName,
      paternalLastName: dto.paternalLastName,
      maternalLastName: dto.maternalLastName ?? null,
      ciNumber,
      email,
      birthDate: dto.birthDate,
      phone: dto.phone ?? null,
      position: dto.position ?? null,
      username,
      password,
      area,
      roles,
      createdBy: actorId,
      mustChangePassword: true,
      now: new Date(),
    });

    await this.userRepository.save(user);
    return user;
  }
}
