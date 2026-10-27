import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { StoredFile } from '@shared/domain/stored-file';
import { FILE_STORAGE } from '@shared/application/ports/file-storage.interface';
import type { IFileStorage } from '@shared/application/ports/file-storage.interface';
import { GetAnimalUseCase } from './get-animal.use-case';

@Injectable()
export class GetAnimalCertificateUseCase {
  constructor(
    @Inject(FILE_STORAGE)
    private readonly fileStorage: IFileStorage,
    private readonly getAnimalUseCase: GetAnimalUseCase,
  ) {}

  async execute(id: string): Promise<{ file: StoredFile; content: Buffer }> {
    const animal = await this.getAnimalUseCase.execute(id);
    const file = animal.getCertificateFile();
    const content = file ? await this.fileStorage.read(file.key) : null;
    if (!file || !content) {
      throw new NotFoundException(
        'El animal no tiene un certificado ABSID adjunto',
      );
    }
    return { file, content };
  }
}
