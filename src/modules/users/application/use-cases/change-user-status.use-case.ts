import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User, toDateOnly } from '../../domain/models/user.model';
import {
  InactiveReason,
  UserStatus,
} from '../../domain/enums/user-status.enum';
import { ChangeUserStatusDto } from '../dtos/change-user-status.dto';
import { GetUserUseCase } from './get-user.use-case';

@Injectable()
export class ChangeUserStatusUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  /**
   * Al dar de baja, el usuario pierde el acceso de inmediato: el guard de
   * autenticación verifica el estado en cada petición.
   */
  async execute(
    actorId: string,
    id: string,
    dto: ChangeUserStatusDto,
  ): Promise<User> {
    const user = await this.getUserUseCase.execute(id);

    if (dto.status === UserStatus.ACTIVE) {
      user.activate();
    } else {
      if (id === actorId) {
        throw new BadRequestException('No puede dar de baja su propio usuario');
      }
      user.deactivate({
        reason: dto.reason ?? InactiveReason.OTHER,
        date: dto.date ?? toDateOnly(new Date()),
        notes: dto.notes ?? null,
      });
    }

    user.markUpdatedBy(actorId);
    await this.userRepository.save(user);
    return user;
  }
}
