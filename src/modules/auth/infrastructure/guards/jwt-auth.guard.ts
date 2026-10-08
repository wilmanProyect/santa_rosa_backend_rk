import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USER_REPOSITORY } from '@modules/users/domain/repositories/user.repository.interface';
import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { SESSION_REPOSITORY } from '../../domain/repositories/session.repository.interface';
import type { ISessionRepository } from '../../domain/repositories/session.repository.interface';
import { TOKEN_SERVICE } from '../../domain/ports/token-service.interface';
import type {
  AccessTokenPayload,
  ITokenService,
} from '../../domain/ports/token-service.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';
import type { AuthenticatedRequest } from '../decorators/current-user.decorator';

/**
 * Guard global: todos los endpoints requieren un access token válido salvo los
 * marcados con @Public().
 *
 * En cada petición verifica contra la BD que la sesión siga abierta y que el
 * usuario siga activo, por lo que dar de baja, cerrar sesión o cambiar permisos
 * tiene efecto inmediato.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepository: ISessionRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Se requiere un token de acceso');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Token de acceso inválido o expirado');
    }

    const now = new Date();
    const [session, user] = await Promise.all([
      this.sessionRepository.findById(payload.sid),
      this.userRepository.findById(payload.sub),
    ]);

    if (
      !session ||
      session.getUserId() !== payload.sub ||
      !session.isActive(now) ||
      !user ||
      !user.isActive() ||
      !user.isSessionStillValid(session.getCreatedAt())
    ) {
      throw new UnauthorizedException(
        'La sesión ya no es válida. Inicie sesión nuevamente.',
      );
    }

    request.user = {
      id: user.getId(),
      username: user.getUsername().getValue(),
      sessionId: session.getId(),
      permissions: user.getEffectivePermissionCodes(),
      mustChangePassword: user.getMustChangePassword(),
    };

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      targets,
    );
    if (user.getMustChangePassword() && !allowPending) {
      throw new ForbiddenException(
        'Debe cambiar su contraseña antes de continuar',
      );
    }

    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [type, token] = header.split(' ');
  return type?.toLowerCase() === 'bearer' && token ? token : null;
}
