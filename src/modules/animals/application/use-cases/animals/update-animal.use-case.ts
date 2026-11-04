import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../../domain/repositories/animal.repository.interface';
import type { IAnimalRepository } from '../../../domain/repositories/animal.repository.interface';
import { Animal } from '../../../domain/models/animal.model';
import { AnimalParent } from '../../../domain/models/animal-parent';
import { AnimalColor } from '../../../domain/models/animal-color.model';
import { UpdateAnimalDto } from '../../dtos/update-animal.dto';
import { AnimalGenealogyService } from '../../services/animal-genealogy.service';
import { AnimalIdentifierService } from '../../services/animal-identifier.service';

const identifierKey = (animal: Animal) =>
  JSON.stringify([
    animal.getEarTag(),
    animal.getAbsidRegistry(),
    animal.getIdentifierException(),
  ]);
import { GetBreedUseCase } from '../breeds/get-breed.use-case';
import { GetAnimalColorUseCase } from '../colors/get-animal-color.use-case';
import { GetAnimalUseCase } from './get-animal.use-case';

@Injectable()
export class UpdateAnimalUseCase {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
    private readonly getAnimalUseCase: GetAnimalUseCase,
    private readonly getBreedUseCase: GetBreedUseCase,
    private readonly getAnimalColorUseCase: GetAnimalColorUseCase,
    private readonly genealogy: AnimalGenealogyService,
    private readonly identifiers: AnimalIdentifierService,
  ) {}

  async execute(
    actorId: string,
    id: string,
    dto: UpdateAnimalDto,
  ): Promise<Animal> {
    const animal = await this.getAnimalUseCase.execute(id);

    await this.assertCompatibleWithOffspring(animal, dto);

    // Una raza o color que ya tenía el animal se conserva aunque hoy esté
    // inactivo; solo se exige que esté activo al asignar uno nuevo.
    const breed =
      dto.breedId !== undefined && dto.breedId !== animal.getBreed().getId()
        ? await this.getBreedUseCase.executeActive(dto.breedId)
        : undefined;

    let color: AnimalColor | null | undefined;
    if (dto.colorId === null) {
      color = null;
    } else if (
      dto.colorId !== undefined &&
      dto.colorId !== animal.getColor()?.getId()
    ) {
      color = await this.getAnimalColorUseCase.executeActive(dto.colorId);
    }

    const dam = await this.resolveParent(dto.damId, animal.getDam(), id);
    const sire = await this.resolveParent(dto.sireId, animal.getSire(), id);

    const identifiersBefore = identifierKey(animal);

    animal.update(
      {
        earTag: dto.earTag,
        name: dto.name,
        species: dto.species,
        breed,
        sex: dto.sex,
        color,
        geneticCategory: dto.geneticCategory,
        absidRegistry: dto.absidRegistry,
        absidCertificateCode: dto.absidCertificateCode,
        externalRegistry: dto.externalRegistry,
        identifierException: dto.identifierException,
        identifierExceptionReason: dto.identifierExceptionReason,
        dam,
        sire,
        birthDate: dto.birthDate,
        entryOrigin: dto.entryOrigin,
        entryDate: dto.entryDate,
        sourceFarm: dto.sourceFarm,
        notes: dto.notes,
      },
      new Date(),
    );

    // Solo se revisan duplicados si cambió el arete, el ABSID o el caso especial.
    if (identifierKey(animal) !== identifiersBefore) {
      await this.identifiers.assertAvailable(animal);
    }

    animal.markUpdatedBy(actorId);
    await this.animalRepository.save(animal);
    return animal;
  }

  /** Las crías ya registradas dependen de la especie, el sexo y la fecha de nacimiento. */
  private async assertCompatibleWithOffspring(
    animal: Animal,
    dto: UpdateAnimalDto,
  ): Promise<void> {
    const speciesChanges =
      dto.species !== undefined && dto.species !== animal.getSpecies();
    const sexChanges = dto.sex !== undefined && dto.sex !== animal.getSex();
    const birthDateChanges =
      dto.birthDate !== undefined && dto.birthDate !== animal.getBirthDate();
    if (!speciesChanges && !sexChanges && !birthDateChanges) return;

    const offspring = await this.animalRepository.getOffspringStats(
      animal.getId(),
    );
    if (offspring.count === 0) return;

    if (speciesChanges || sexChanges) {
      throw new ConflictException(
        `No se puede cambiar la especie ni el sexo: el animal tiene ${offspring.count} cría(s) registradas`,
      );
    }
    if (
      dto.birthDate &&
      offspring.earliestBirthDate &&
      dto.birthDate >= offspring.earliestBirthDate
    ) {
      throw new BadRequestException(
        `La fecha de nacimiento debe ser anterior a la de su cría más antigua (${offspring.earliestBirthDate})`,
      );
    }
  }

  private async resolveParent(
    parentId: string | null | undefined,
    current: AnimalParent | null,
    childId: string,
  ): Promise<AnimalParent | null | undefined> {
    if (parentId !== undefined && parentId === current?.id) return undefined;
    return this.genealogy.resolveParent(parentId, childId);
  }
}
