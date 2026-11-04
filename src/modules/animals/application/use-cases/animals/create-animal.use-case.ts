import { Inject, Injectable } from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { CreateAnimalDto } from '../../dtos/create-animal.dto';
import { AnimalGenealogyService } from '../../services/animal-genealogy.service';
import { AnimalIdentifierService } from '../../services/animal-identifier.service';
import { GetBreedUseCase } from '../breeds/get-breed.use-case';
import { GetAnimalColorUseCase } from '../colors/get-animal-color.use-case';

@Injectable()
export class CreateAnimalUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    private readonly getBreedUseCase: GetBreedUseCase,
    private readonly getAnimalColorUseCase: GetAnimalColorUseCase,
    private readonly genealogy: AnimalGenealogyService,
    private readonly identifiers: AnimalIdentifierService,
  ) {}

  async execute(actorId: string, dto: CreateAnimalDto): Promise<Animal> {
    const breed = await this.getBreedUseCase.executeActive(dto.breedId);
    const color = dto.colorId
      ? await this.getAnimalColorUseCase.executeActive(dto.colorId)
      : null;
    const dam = await this.genealogy.resolveParent(dto.damId ?? null, null);
    const sire = await this.genealogy.resolveParent(dto.sireId ?? null, null);

    const animal = Animal.create({
      isExternal: dto.isExternal ?? false,
      earTag: dto.earTag ?? null,
      name: dto.name ?? null,
      species: dto.species,
      breed,
      sex: dto.sex,
      color,
      geneticCategory: dto.geneticCategory ?? null,
      absidRegistry: dto.absidRegistry ?? null,
      absidCertificateCode: dto.absidCertificateCode ?? null,
      externalRegistry: dto.externalRegistry ?? null,
      identifierException: dto.identifierException ?? false,
      identifierExceptionReason: dto.identifierExceptionReason ?? null,
      dam: dam ?? null,
      sire: sire ?? null,
      birthDate: dto.birthDate ?? null,
      // Sin valor: el modelo asume BORN_ON_FARM (o null si es externo).
      entryOrigin: dto.entryOrigin,
      entryDate: dto.entryDate ?? null,
      sourceFarm: dto.sourceFarm ?? null,
      notes: dto.notes ?? null,
      createdBy: actorId,
      now: new Date(),
    });

    await this.identifiers.assertAvailable(animal);
    await this.animalRepository.save(animal);
    return animal;
  }
}
