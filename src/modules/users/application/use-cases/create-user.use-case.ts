import { Inject, Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '../../domain/ports/password-hasher.interface';
import type { IPasswordHasher } from '../../domain/ports/password-hasher.interface';
import { ROLE_REPOSITORY } from '@modules/roles-permissions/domain/repositories/role.repository.interface';
import type { IRoleRepository } from '@modules/roles-permissions/domain/repositories/role.repository.interface';
import { User } from '../../domain/models/user.model';
import { Email } from '../../domain/value-objects/email.vo';
import { Password } from '../../domain/value-objects/password.vo';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UUID } from '@shared/domain/value-objects/uuid.vo';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: IPasswordHasher,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(dto: CreateUserDto): Promise<User> {
    const emailVo = new Email(dto.email);

    const existingUser = await this.userRepository.findByEmail(emailVo.getValue());
    if (existingUser) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);
    const passwordVo = new Password(passwordHash);

    let roles = [];
    if (dto.roleIds && dto.roleIds.length > 0) {
      for (const roleId of dto.roleIds) {
        const role = await this.roleRepository.findById(roleId);
        if (!role) {
          throw new NotFoundException(`Role with ID "${roleId}" not found`);
        }
        roles.push(role);
      }
    }

    const userId = new UUID().getValue();
    const user = new User(
      userId,
      dto.name,
      emailVo,
      passwordVo,
      true,
      roles,
    );

    await this.userRepository.save(user);
    return user;
  }
}
