import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { ANIMAL_REPOSITORY } from '../../domain/repositories/animal.repository.interface';
import type {
  IAnimalRepository,
  IdentifierMatch,
} from '../../domain/repositories/animal.repository.interface';
import { Animal } from '../../domain/models/animal.model';

/** Códigos de error para que el frontend sepa cuándo ofrecer el "caso especial". */
export const DUPLICATE_IDENTIFIER = 'DUPLICATE_IDENTIFIER';
export const DUPLICATE_EAR_TAG_AND_ABSID = 'DUPLICATE_EAR_TAG_AND_ABSID';

/**
 * Unicidad del arete y del registro ABSID, dentro de cada especie (ovinos y
 * caprinos tienen numeración y registro propios).
 *
 * - Por defecto ninguno de los dos puede repetirse entre animales normales
 *   (los que no son caso especial). El arete se compara solo
 *   entre animales de la cabaña: es una numeración propia y un animal externo
 *   puede traer el de su cabaña de origen.
 * - Un animal marcado como caso especial (identifierException) puede repetir
 *   cualquiera de los dos: existe así en la cabaña y no se corrige.
 * - La misma combinación arete + ABSID nunca se repite: sería el mismo animal
 *   cargado dos veces.
 *
 * Los índices únicos parciales de la BD aplican las mismas reglas.
 */
@Injectable()
export class AnimalIdentifierService {
  constructor(
    @Inject(ANIMAL_REPOSITORY)
    private readonly animalRepository: IAnimalRepository,
  ) {}

  async assertAvailable(animal: Animal): Promise<void> {
    const earTag = animal.getEarTag();
    const absidRegistry = animal.getAbsidRegistry();
    const matches = await this.animalRepository.findIdentifierMatches({
      species: animal.getSpecies(),
      earTag,
      absidRegistry,
      excludeId: animal.getId(),
    });
    if (matches.length === 0) return;

    const samePair = matches.filter(
      (m) =>
        earTag &&
        absidRegistry &&
        m.earTag === earTag &&
        m.absidRegistry === absidRegistry,
    );
    if (samePair.length > 0) {
      throw conflict(
        DUPLICATE_EAR_TAG_AND_ABSID,
        `Ya existe un animal con el arete "${earTag}" y el registro ABSID "${absidRegistry}". Esta combinación no puede repetirse, ni siquiera como caso especial.`,
        ['earTag', 'absidRegistry'],
        samePair,
      );
    }

    if (animal.getIdentifierException()) return;

    // Un animal normal solo choca con otros normales: los casos especiales
    // nunca bloquean al animal original con el que comparten arete o ABSID.
    const regular = matches.filter((m) => !m.identifierException);
    const sameEarTag =
      earTag && !animal.getIsExternal()
        ? regular.filter((m) => !m.isExternal && m.earTag === earTag)
        : [];
    const sameAbsid = absidRegistry
      ? regular.filter((m) => m.absidRegistry === absidRegistry)
      : [];
    if (sameEarTag.length === 0 && sameAbsid.length === 0) return;

    const fields: string[] = [];
    const parts: string[] = [];
    if (sameEarTag.length > 0) {
      fields.push('earTag');
      parts.push(`el arete "${earTag}"`);
    }
    if (sameAbsid.length > 0) {
      fields.push('absidRegistry');
      parts.push(`el registro ABSID "${absidRegistry}"`);
    }
    const conflicts = [...new Set([...sameEarTag, ...sameAbsid])];

    throw conflict(
      DUPLICATE_IDENTIFIER,
      `Ya hay ${conflicts.length === 1 ? 'otro animal' : 'otros animales'} con ${parts.join(' y ')}: ${conflicts.map(describe).join(', ')}. Si el animal está registrado así en la cabaña, regístrelo como caso especial indicando el motivo.`,
      fields,
      conflicts,
    );
  }
}

function conflict(
  code: string,
  message: string,
  fields: string[],
  conflicts: IdentifierMatch[],
) {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code,
    message,
    fields,
    conflicts: conflicts.map((m) => ({
      id: m.id,
      earTag: m.earTag,
      name: m.name,
      absidRegistry: m.absidRegistry,
      isExternal: m.isExternal,
    })),
  });
}

const describe = (m: IdentifierMatch) =>
  [m.earTag ?? 'sin arete', m.name ? `"${m.name}"` : null, m.absidRegistry]
    .filter(Boolean)
    .join(' ');
