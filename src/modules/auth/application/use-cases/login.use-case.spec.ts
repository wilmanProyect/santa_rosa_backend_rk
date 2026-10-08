import { UnauthorizedException } from '@nestjs/common';
import { User } from '@modules/users/domain/models/user.model';
import { Username } from '@modules/users/domain/value-objects/username.vo';
import { Password } from '@modules/users/domain/value-objects/password.vo';
import { InactiveReason } from '@modules/users/domain/enums/user-status.enum';
import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import type { IPasswordHasher } from '@modules/users/domain/ports/password-hasher.interface';
import type { ILoginAttemptRepository } from '../../domain/repositories/login-attempt.repository.interface';
import { LoginAttempt } from '../../domain/models/login-attempt.model';
import { LoginFailureReason } from '../../domain/enums/auth.enums';
import {
  AuthTokens,
  SessionIssuerService,
} from '../services/session-issuer.service';
import { LoginUseCase } from './login.use-case';

const context = { ip: '127.0.0.1', userAgent: 'jest' };
const settings = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlDays: 7,
  maxFailedAttempts: 3,
  lockMinutes: 15,
};
const tokens = { accessToken: 'access', refreshToken: 'refresh' } as AuthTokens;

const buildUser = () =>
  User.create({
    firstName: 'Admin',
    paternalLastName: 'Sistema',
    maternalLastName: null,
    ciNumber: null,
    email: null,
    birthDate: null,
    phone: null,
    position: null,
    username: new Username('admin'),
    password: new Password('hash:Admin123'),
    area: null,
    roles: [],
    createdBy: null,
    now: new Date(),
  });

describe('LoginUseCase', () => {
  let user: User | null;
  let attempts: LoginAttempt[];
  let useCase: LoginUseCase;
  let userRepository: jest.Mocked<
    Pick<IUserRepository, 'findByUsername' | 'saveLoginState'>
  >;
  let issue: jest.Mock;

  beforeEach(() => {
    user = buildUser();
    attempts = [];
    userRepository = {
      findByUsername: jest.fn<Promise<User | null>, [string]>(() =>
        Promise.resolve(user),
      ),
      saveLoginState: jest.fn<Promise<void>, [User]>(() => Promise.resolve()),
    };
    const hasher: IPasswordHasher = {
      hash: (plain) => Promise.resolve(`hash:${plain}`),
      compare: (plain, hash) => Promise.resolve(hash === `hash:${plain}`),
    };
    const attemptRepository = {
      save: (attempt: LoginAttempt) => {
        attempts.push(attempt);
        return Promise.resolve();
      },
    } as ILoginAttemptRepository;
    issue = jest.fn(() => Promise.resolve(tokens));

    useCase = new LoginUseCase(
      userRepository as unknown as IUserRepository,
      hasher,
      attemptRepository,
      settings,
      { issue } as unknown as SessionIssuerService,
    );
  });

  it('inicia sesión con credenciales correctas (sin distinguir mayúsculas en el usuario)', async () => {
    const result = await useCase.execute(
      { username: ' ADMIN ', password: 'Admin123' },
      context,
    );

    expect(result.tokens).toBe(tokens);
    expect(userRepository.findByUsername).toHaveBeenCalledWith('admin');
    expect(user!.getLastLoginAt()).not.toBeNull();
    expect(attempts.map((a) => a.getSuccess())).toEqual([true]);
  });

  it('rechaza un usuario inexistente con el mismo mensaje genérico', async () => {
    user = null;

    await expect(
      useCase.execute({ username: 'nadie', password: 'x' }, context),
    ).rejects.toThrow('Usuario o contraseña incorrectos');
    expect(attempts[0].getFailureReason()).toBe(
      LoginFailureReason.INVALID_CREDENTIALS,
    );
    expect(attempts[0].getUserId()).toBeNull();
  });

  it('bloquea la cuenta tras el máximo de intentos y rechaza incluso la contraseña correcta', async () => {
    for (let i = 0; i < settings.maxFailedAttempts; i++) {
      await expect(
        useCase.execute({ username: 'admin', password: 'mala' }, context),
      ).rejects.toThrow(UnauthorizedException);
    }

    await expect(
      useCase.execute({ username: 'admin', password: 'Admin123' }, context),
    ).rejects.toThrow(/bloqueada/);
    expect(attempts.at(-1)!.getFailureReason()).toBe(
      LoginFailureReason.ACCOUNT_LOCKED,
    );
    expect(issue).not.toHaveBeenCalled();
  });

  it('rechaza a un usuario dado de baja', async () => {
    user!.deactivate({
      reason: InactiveReason.DISMISSAL,
      date: '2026-10-01',
      notes: null,
    });

    await expect(
      useCase.execute({ username: 'admin', password: 'Admin123' }, context),
    ).rejects.toThrow(/inactivo/);
    expect(attempts[0].getFailureReason()).toBe(
      LoginFailureReason.USER_INACTIVE,
    );
    expect(issue).not.toHaveBeenCalled();
  });
});
