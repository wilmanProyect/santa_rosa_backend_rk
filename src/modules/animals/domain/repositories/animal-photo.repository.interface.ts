import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { AnimalPhoto } from '../models/animal-photo.model';

export interface IAnimalPhotoRepository {
  /** Solo fotos no eliminadas del animal indicado. */
  findById(animalId: string, photoId: string): Promise<AnimalPhoto | null>;
  findByChecksum(
    animalId: string,
    checksumSha256: string,
  ): Promise<AnimalPhoto | null>;
  /**
   * Historial del animal, de la más reciente a la más antigua: por fecha de la
   * foto y, si no la tiene, por fecha de subida.
   */
  findPaginated(
    animalId: string,
    pagination: PaginationParams,
  ): Promise<Paginated<AnimalPhoto>>;
  /** Foto principal de cada animal indicado (para listados). */
  findPrimaryByAnimalIds(animalIds: string[]): Promise<AnimalPhoto[]>;
  countByAnimal(animalId: string): Promise<number>;
  /** Inserta la foto. Si es principal, desmarca la anterior en la misma transacción. */
  create(photo: AnimalPhoto): Promise<void>;
  /** Guarda descripción y fecha. */
  update(photo: AnimalPhoto): Promise<void>;
  /** Marca la foto como principal y desmarca la anterior, en una transacción. */
  setPrimary(photo: AnimalPhoto, actorId: string): Promise<void>;
  /**
   * Borrado lógico. Si era la principal, la foto más reciente que queda pasa a
   * serlo. Todo en una transacción.
   */
  softDelete(photo: AnimalPhoto, actorId: string): Promise<void>;
}

export const ANIMAL_PHOTO_REPOSITORY = Symbol('IAnimalPhotoRepository');
