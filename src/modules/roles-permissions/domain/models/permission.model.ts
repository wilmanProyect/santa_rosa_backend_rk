export class Permission {
  constructor(
    private readonly id: string,
    private readonly code: string,
    private module: string,
    private description: string,
  ) {}

  public getId(): string {
    return this.id;
  }

  public getCode(): string {
    return this.code;
  }

  public getModule(): string {
    return this.module;
  }

  public getDescription(): string {
    return this.description;
  }

  public updateDetails(module: string, description: string): void {
    this.module = module;
    this.description = description;
  }
}
