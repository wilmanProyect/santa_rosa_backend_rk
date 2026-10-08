import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '@modules/users/users.module';
import { SessionOrmEntity } from './infrastructure/persistence/entities/session.orm-entity';
import { LoginAttemptOrmEntity } from './infrastructure/persistence/entities/login-attempt.orm-entity';
import { SESSION_REPOSITORY } from './domain/repositories/session.repository.interface';
import { LOGIN_ATTEMPT_REPOSITORY } from './domain/repositories/login-attempt.repository.interface';
import { TOKEN_SERVICE } from './domain/ports/token-service.interface';
import { SessionTypeormRepository } from './infrastructure/persistence/repositories/session.typeorm.repository';
import { LoginAttemptTypeormRepository } from './infrastructure/persistence/repositories/login-attempt.typeorm.repository';
import { JwtTokenServiceAdapter } from './infrastructure/adapters/jwt-token-service.adapter';
import { AUTH_SETTINGS, AuthSettings } from './application/auth-settings';
import { SessionIssuerService } from './application/services/session-issuer.service';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { ChangeOwnPasswordUseCase } from './application/use-cases/change-own-password.use-case';
import { ListLoginHistoryUseCase } from './application/use-cases/list-login-history.use-case';
import { AuthController } from './infrastructure/controllers/auth.controller';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { PermissionsGuard } from './infrastructure/guards/permissions.guard';

const MIN_JWT_SECRET_LENGTH = 32;

function readJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET no está definido o tiene menos de ${MIN_JWT_SECRET_LENGTH} caracteres. Configúrelo en el archivo .env`,
    );
  }
  return secret;
}

function readAuthSettings(config: ConfigService): AuthSettings {
  return {
    accessTokenTtlSeconds:
      Number(config.get('JWT_ACCESS_TTL_MINUTES', 15)) * 60,
    refreshTokenTtlDays: Number(config.get('JWT_REFRESH_TTL_DAYS', 7)),
    maxFailedAttempts: Number(config.get('AUTH_MAX_FAILED_ATTEMPTS', 5)),
    lockMinutes: Number(config.get('AUTH_LOCK_MINUTES', 15)),
  };
}

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionOrmEntity, LoginAttemptOrmEntity]),
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: readJwtSecret(config),
        signOptions: {
          expiresIn: readAuthSettings(config).accessTokenTtlSeconds,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_SETTINGS,
      inject: [ConfigService],
      useFactory: readAuthSettings,
    },
    {
      provide: SESSION_REPOSITORY,
      useClass: SessionTypeormRepository,
    },
    {
      provide: LOGIN_ATTEMPT_REPOSITORY,
      useClass: LoginAttemptTypeormRepository,
    },
    {
      provide: TOKEN_SERVICE,
      useClass: JwtTokenServiceAdapter,
    },
    SessionIssuerService,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    ChangeOwnPasswordUseCase,
    ListLoginHistoryUseCase,
    // El orden importa: primero autenticación, luego permisos.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AuthModule {}
