import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import type { IFileStorage } from '@shared/application/ports/file-storage.interface';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { GetAnimalUseCase } from './get-animal.use-case';

@Injectable()
export class DeleteAnimalCertificateUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  async execute(actorId: string, id: string): Promise<void> {
    const animal = await this.getAnimalUseCase.execute(id);
    const previous = animal.removeCertificateFile();
    if (!previous) {
      throw new NotFoundException(
        'El animal no tiene un certificado ABSID adjunto',
      );
    }

    animal.markUpdatedBy(actorId);
    await this.animalRepository.save(animal);
    await this.fileStorage.delete(previous.key);
  }
}
