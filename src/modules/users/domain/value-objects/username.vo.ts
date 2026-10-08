import { DomainError } from '@shared/domain/errors/domain.error';

export class Username {
  static readonly PATTERN = /^[a-z0-9._-]{3,30}$/;

  private readonly value: string;

  constructor(username: string) {
    const normalized = (username ?? '').trim().toLowerCase();
    if (!Username.PATTERN.test(normalized)) {
      throw new DomainError(
        'El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo',
      );
    }
    this.value = normalized;
  }

  getValue(): string {
    return this.value;
  }
}
