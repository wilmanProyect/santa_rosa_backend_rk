import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import { auditContextStorage } from '@shared/infrastructure/audit/audit-context';

/**
 * Ejecuta cada petición dentro de su contexto de auditoría (usuario, IP e id de
 * petición). Corre después de los guards, así que el usuario ya está
 * autenticado. Las consultas que la petición hace a la base llevan ese
 * contexto (ver AuditDbSession).
 */
@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const store = {
      actorId: request.user?.id ?? null,
      requestId: randomUUID(),
      ip: request.ip?.slice(0, 64) ?? null,
    };
    // El handler se ejecuta al suscribirse: dentro de run() hereda el contexto.
    return new Observable((subscriber) =>
      auditContextStorage.run(store, () => next.handle().subscribe(subscriber)),
    );
  }
}
