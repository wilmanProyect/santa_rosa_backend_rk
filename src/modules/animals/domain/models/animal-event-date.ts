import { DomainError } from '@shared/domain/errors/domain.error';
import { toDateOnly } from '@shared/domain/date-only';
import { AnimalStatus } from '../enums/animal.enums';
import { Animal } from './animal.model';

/**
 * Reglas comunes a los eventos del historial de un animal (pesajes, eventos
 * sanitarios): solo animales de la cabaña y fecha dentro de su vida en ella.
 */
export function assertAnimalEventDate(
  animal: Animal,
  date: string,
  label: string,
  now: Date,
): void {
  if (animal.getIsExternal()) {
    throw new DomainError(
      'Los animales externos no forman parte de la cabaña: no se les registran eventos',
    );
  }
  if (date > toDateOnly(now)) {
    throw new DomainError(`${label} no puede ser futura`);
  }
  const birthDate = animal.getBirthDate();
  if (birthDate && date < birthDate) {
    throw new DomainError(
      `${label} no puede ser anterior al nacimiento del animal (${birthDate})`,
    );
  }
  const statusDate = animal.getStatusDate();
  if (
    animal.getStatus() !== AnimalStatus.ALIVE &&
    statusDate &&
    date > statusDate
  ) {
    throw new DomainError(
      `${label} no puede ser posterior a la salida del animal (${statusDate})`,
    );
  }
}

/** Días entre dos fechas YYYY-MM-DD. */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(date: string, days: number): string {
  return toDateOnly(
    new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000),
  );
}
