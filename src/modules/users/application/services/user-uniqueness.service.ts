import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/models/user.model';

/**
 * Verifica que usuario, correo y CI no estén en uso por otro usuario.
 * La BD también tiene índices únicos; esto solo da mensajes de error claros.
 */
@Injectable()
export class UserUniquenessService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async assertAvailable(
    values: {
      username?: string;
      email?: string | null;
      ciNumber?: string | null;
    },
    currentUserId?: string,
  ): Promise<void> {
    const isOther = (user: User | null) =>
      !!user && user.getId() !== currentUserId;

    if (
      values.username &&
      isOther(await this.userRepository.findByUsername(values.username))
    ) {
      throw new ConflictException(
        `El usuario "${values.username}" ya está en uso`,
      );
    }
    if (
      values.email &&
      isOther(await this.userRepository.findByEmail(values.email))
    ) {
      throw new ConflictException(
        `El correo "${values.email}" ya está registrado`,
      );
    }
    if (
      values.ciNumber &&
      isOther(await this.userRepository.findByCiNumber(values.ciNumber))
    ) {
      throw new ConflictException(
        `El CI "${values.ciNumber}" ya está registrado`,
      );
    }
  }
}
