import { Email } from '../value-objects/email.vo';
import { Password } from '../value-objects/password.vo';
import { Role } from '@modules/roles-permissions/domain/models/role.model';

export class User {
  constructor(
    private readonly id: string,
    private name: string,
    private email: Email,
    private password: Password,
    private isActive: boolean,
    private roles: Role[] = [],
  ) {}

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getEmail(): Email {
    return this.email;
  }

  public getPassword(): Password {
    return this.password;
  }

  public getIsActive(): boolean {
    return this.isActive;
  }

  public getRoles(): Role[] {
    return this.roles;
  }

  public updateName(name: string): void {
    if (!name || name.trim() === '') {
      throw new Error('User name cannot be empty');
    }
    this.name = name;
  }

  public updateEmail(email: Email): void {
    this.email = email;
  }

  public updatePassword(password: Password): void {
    this.password = password;
  }

  public activate(): void {
    this.isActive = true;
  }

  public deactivate(): void {
    this.isActive = false;
  }

  public assignRoles(roles: Role[]): void {
    this.roles = roles;
  }
}
