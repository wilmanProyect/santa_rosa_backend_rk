import { randomUUID } from 'crypto';

export class UUID {
  private readonly value: string;

  constructor(value?: string) {
    if (value) {
      if (!this.validate(value)) {
        throw new Error(`Invalid UUID: ${value}`);
      }
      this.value = value;
    } else {
      this.value = randomUUID();
    }
  }

  private validate(uuid: string): boolean {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return re.test(uuid);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: UUID): boolean {
    return this.value === other.getValue();
  }
}
