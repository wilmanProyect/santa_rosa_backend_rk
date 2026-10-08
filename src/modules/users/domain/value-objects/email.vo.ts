import { DomainError } from '@shared/domain/errors/domain.error';

export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.validate(email)) {
      throw new DomainError(`Correo electrónico inválido: ${email}`);
    }
    this.value = email.toLowerCase().trim();
  }

  private validate(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test((email ?? '').trim());
  }

  getValue(): string {
    return this.value;
  }
}
