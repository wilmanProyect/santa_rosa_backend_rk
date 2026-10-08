import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type {
  AuthenticatedUser,
  RequestContext,
} from '../../domain/authenticated-user';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

/** Inyecta el usuario autenticado de la petición. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

/** Inyecta IP y user-agent del cliente, para auditoría. */
export const ClientContext = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const userAgent = request.headers['user-agent'];
    return {
      ip: request.ip?.slice(0, 64) ?? null,
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 255) : null,
    };
  },
);
