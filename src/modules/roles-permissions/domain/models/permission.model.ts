export class Permission {
  constructor(
    private readonly id: string,
    private name: string,
    private description: string,
  ) {}

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getDescription(): string {
    return this.description;
  }

  public updateDescription(description: string): void {
    this.description = description;
  }
}
