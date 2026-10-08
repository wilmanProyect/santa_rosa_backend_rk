import { Inject, Injectable } from '@nestjs/common';
import { GetAreaUseCase } from '@modules/areas/application/use-cases/get-area.use-case';
import { USER_REPOSITORY } from '../../domain/repositories/user.repository.interface';
import type { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { User } from '../../domain/models/user.model';
import { Email } from '../../domain/value-objects/email.vo';
import { Username } from '../../domain/value-objects/username.vo';
import { UpdateUserDto } from '../dtos/update-user.dto';
import { UserUniquenessService } from '../services/user-uniqueness.service';
import { GetUserUseCase } from './get-user.use-case';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly getAreaUseCase: GetAreaUseCase,
    private readonly uniqueness: UserUniquenessService,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateUserDto,
  ): Promise<User> {
    const user = await this.getUserUseCase.execute(id);

    const username =
      dto.username !== undefined ? new Username(dto.username) : undefined;
    const email = dto.email !== undefined ? new Email(dto.email) : undefined;
    const ciNumber =
      dto.ciNumber !== undefined
        ? dto.ciNumber.trim().toUpperCase()
        : undefined;

    await this.uniqueness.assertAvailable(
      { username: username?.getValue(), email: email?.getValue(), ciNumber },
      id,
    );

    user.updatePersonalData(
      {
        firstName: dto.firstName,
        paternalLastName: dto.paternalLastName,
        maternalLastName: dto.maternalLastName,
        ciNumber,
        email,
        birthDate: dto.birthDate,
        phone: dto.phone,
        position: dto.position,
      },
      new Date(),
    );

    if (username) {
      user.changeUsername(username);
    }

    if (dto.areaId !== undefined) {
      const area = dto.areaId
        ? await this.getAreaUseCase.executeActive(dto.areaId)
        : null;
      user.assignArea(area);
    }

    user.markUpdatedBy(actorId);
    await this.userRepository.save(user);
    return user;
  }
}
