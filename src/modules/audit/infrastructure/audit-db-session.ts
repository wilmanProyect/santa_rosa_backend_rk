import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AuditContext,
  currentAuditContext,
} from '@shared/infrastructure/audit/audit-context';

const AUDIT_KEY = Symbol('auditContextKey');
const PATCHED = Symbol('auditSessionPatched');

/** Lo que necesitamos de la conexión de `pg` y del driver de TypeORM. */
interface PgClient {
  query(sql: string, params: unknown[]): Promise<unknown>;
  [AUDIT_KEY]?: string;
}
type Release = (err?: unknown) => void;
interface PostgresDriverLike {
  obtainMasterConnection(): Promise<[PgClient, Release]>;
  [PATCHED]?: boolean;
}

const keyOf = (ctx: AuditContext | undefined) =>
  ctx ? `${ctx.actorId ?? ''}|${ctx.requestId}|${ctx.ip ?? ''}` : '';

/**
 * Pasa el contexto de auditoría de la petición a la sesión de PostgreSQL, donde
 * lo leen los triggers del registro de actividad (audit_capture).
 *
 * Cada vez que TypeORM toma una conexión del pool, se fijan app.actor_id,
 * app.request_id, app.ip y app.source para el contexto de quien la pide (o se
 * vacían si no hay petición). Solo se ejecuta cuando la conexión tenía otro
 * contexto, así que cuesta una consulta por petición y conexión.
 */
@Injectable()
export class AuditDbSession implements OnModuleInit {
  constructor(private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    const driver = this.dataSource.driver as unknown as PostgresDriverLike;
    if (driver[PATCHED]) return;
    const obtain = driver.obtainMasterConnection.bind(driver);
    driver.obtainMasterConnection = async () => {
      // Se lee antes del primer await: es el contexto de quien pide la conexión.
      const ctx = currentAuditContext();
      const [client, release] = await obtain();
      const key = keyOf(ctx);
      if ((client[AUDIT_KEY] ?? '') !== key) {
        try {
          await client.query(
            `SELECT set_config('app.actor_id', $1, false), set_config('app.request_id', $2, false),
                    set_config('app.ip', $3, false), set_config('app.source', $4, false)`,
            [
              ctx?.actorId ?? '',
              ctx?.requestId ?? '',
              ctx?.ip ?? '',
              ctx ? 'API' : 'SYSTEM',
            ],
          );
          client[AUDIT_KEY] = key;
        } catch (error) {
          release(error);
          throw error;
        }
      }
      return [client, release];
    };
    driver[PATCHED] = true;
  }
}
