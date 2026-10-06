export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.validate(email)) {
      throw new Error(`Invalid email address: ${email}`);
    }
    this.value = email.toLowerCase().trim();
  }

  private validate(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  getValue(): string {
    return this.value;
  }
}
