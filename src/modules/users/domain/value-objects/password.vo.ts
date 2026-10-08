import { DomainError } from '@shared/domain/errors/domain.error';

/** Contraseña ya hasheada. Nunca contiene el texto plano. */
export class Password {
  private readonly hash: string;

  constructor(hash: string) {
    if (!hash || hash.trim() === '') {
      throw new DomainError('El hash de la contraseña no puede estar vacío');
    }
    this.hash = hash;
  }

  getHash(): string {
    return this.hash;
  }
}
