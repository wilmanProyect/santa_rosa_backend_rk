export class Password {
  private readonly hash: string;

  constructor(hash: string) {
    if (!hash || hash.trim() === '') {
      throw new Error('Password hash cannot be empty');
    }
    this.hash = hash;
  }

  getHash(): string {
    return this.hash;
  }
}
