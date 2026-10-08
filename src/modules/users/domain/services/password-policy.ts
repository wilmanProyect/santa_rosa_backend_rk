import { DomainError } from '@shared/domain/errors/domain.error';

export const PASSWORD_MIN_LENGTH = 8;
/** bcrypt ignora todo lo que pase de 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Política de contraseñas: 8 a 72 caracteres, con al menos una mayúscula,
 * una minúscula y un número.
 */
export function assertPasswordPolicy(plain: string): void {
  if (
    typeof plain !== 'string' ||
    plain.length < PASSWORD_MIN_LENGTH ||
    Buffer.byteLength(plain, 'utf8') > PASSWORD_MAX_LENGTH ||
    !/[A-Z]/.test(plain) ||
    !/[a-z]/.test(plain) ||
    !/[0-9]/.test(plain)
  ) {
    throw new DomainError(
      `La contraseña debe tener entre ${PASSWORD_MIN_LENGTH} y ${PASSWORD_MAX_LENGTH} caracteres e incluir al menos una mayúscula, una minúscula y un número`,
    );
  }
}
