import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import type { AuditEvent } from '@shared/application/ports/audit-events.interface';
import type { AuditContext } from '@shared/infrastructure/audit/audit-context';
import {
  AuditAction,
  AuditEntry,
  AuditFilters,
  AuditRef,
  AuditSource,
} from '../domain/audit.types';

interface AuditDbRow {
  id: string;
  occurred_at: Date;
  actor_id: string | null;
  actor_username: string | null;
  actor_full_name: string | null;
  request_id: string | null;
  ip: string | null;
  source: AuditSource;
  action: AuditAction;
  entity: string;
  record_id: string | null;
  animal_ids: string[];
  changes: Record<string, unknown> | null;
  event: AuditEntry['event'];
  summary: string | null;
}

@Injectable()
export class AuditTypeormRepository {
  constructor(private readonly db: DataSource) {}

  async insertEvent(
    event: AuditEvent,
    ctx: AuditContext | undefined,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_log
         (actor_id, request_id, ip, source, action, entity, record_id, animal_ids, changes, event, summary)
       VALUES ($1, $2, $3, $4, 'EVENT', $5, $6, $7::uuid[], $8, $9, $10)`,
      [
        ctx?.actorId ?? null,
        ctx?.requestId ?? null,
        ctx?.ip ?? null,
        ctx ? AuditSource.API : AuditSource.SYSTEM,
        event.entity,
        event.recordId?.slice(0, 100) ?? null,
        event.animalIds ?? [],
        event.details ? JSON.stringify(event.details) : null,
        event.event,
        event.summary.slice(0, 300),
      ],
    );
  }

  async find(
    filters: AuditFilters,
    { page, limit }: PaginationParams,
    timeZone: string,
  ): Promise<Paginated<AuditEntry>> {
    const params: unknown[] = [];
    const param = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    const where: string[] = [];
    if (filters.userId) where.push(`a.actor_id = ${param(filters.userId)}`);
    if (filters.entity) where.push(`a.entity = ${param(filters.entity)}`);
    if (filters.recordId)
      where.push(`a.record_id = ${param(filters.recordId)}`);
    if (filters.animalId)
      where.push(`a.animal_ids @> ARRAY[${param(filters.animalId)}]::uuid[]`);
    if (filters.action) where.push(`a.action = ${param(filters.action)}`);
    if (filters.event) where.push(`a.event = ${param(filters.event)}`);
    if (filters.source) where.push(`a.source = ${param(filters.source)}`);
    if (filters.requestId)
      where.push(`a.request_id = ${param(filters.requestId)}`);
    if (filters.from || filters.to) {
      const tz = param(timeZone);
      if (filters.from)
        where.push(
          `a.occurred_at >= (${param(filters.from)}::date)::timestamp AT TIME ZONE ${tz}`,
        );
      if (filters.to)
        where.push(
          `a.occurred_at < (${param(filters.to)}::date + 1)::timestamp AT TIME ZONE ${tz}`,
        );
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ total }] = await this.db.query<{ total: string }[]>(
      `SELECT COUNT(*) AS total FROM audit_log a ${whereSql}`,
      params,
    );
    const rows = await this.db.query<AuditDbRow[]>(
      `SELECT a.id::text AS id, a.occurred_at, a.actor_id, u.username AS actor_username,
              nullif(concat_ws(' ', u.first_name, u.paternal_last_name, u.maternal_last_name), '') AS actor_full_name,
              a.request_id, a.ip, a.source, a.action, a.entity, a.record_id,
              a.animal_ids::text[] AS animal_ids, a.changes, a.event, a.summary
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_id
         ${whereSql}
        ORDER BY a.occurred_at DESC, a.id DESC
        LIMIT ${param(limit)} OFFSET ${param((page - 1) * limit)}`,
      params,
    );
    return {
      items: rows.map((r) => ({
        id: r.id,
        occurredAt: r.occurred_at,
        actorId: r.actor_id,
        actorUsername: r.actor_username,
        actorFullName: r.actor_full_name,
        requestId: r.request_id,
        ip: r.ip,
        source: r.source,
        action: r.action,
        entity: r.entity,
        recordId: r.record_id,
        animalIds: r.animal_ids ?? [],
        changes: r.changes,
        event: r.event,
        summary: r.summary,
      })),
      total: Number(total),
      page,
      limit,
    };
  }

  /** Incluye los animales borrados: su historial se sigue pudiendo consultar. */
  async animalExists(id: string): Promise<boolean> {
    const rows = await this.db.query<unknown[]>(
      `SELECT 1 FROM animals WHERE id = $1`,
      [id],
    );
    return rows.length > 0;
  }

  /** Nombre legible de los ids que aparecen en el historial (raza, animal, usuario...). */
  async resolveRefs(ids: string[]): Promise<Record<string, AuditRef>> {
    if (ids.length === 0) return {};
    const rows = await this.db.query<
      { id: string; type: AuditRef['type']; label: string }[]
    >(
      `SELECT id::text, 'animal' AS type, concat_ws(' ', ear_tag, name) AS label FROM animals WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'breed', name FROM breeds WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'color', name FROM animal_colors WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'area', name FROM areas WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'product', name FROM veterinary_products WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'role', name FROM roles WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'permission', code FROM permissions WHERE id = ANY($1::uuid[])
       UNION ALL SELECT id::text, 'user', username FROM users WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    return Object.fromEntries(
      rows.map((r) => [r.id, { type: r.type, label: r.label }]),
    );
  }
}
