import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AuditEvent,
  IAuditEvents,
} from '@shared/application/ports/audit-events.interface';
import { currentAuditContext } from '@shared/infrastructure/audit/audit-context';
import { PaginationParams } from '@shared/domain/paginated';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import {
  AUDIT_ENTITY_LABELS,
  AUDIT_EVENT_LABELS,
  AuditEntry,
  AuditFilters,
  AuditRef,
} from '../domain/audit.types';
import { AuditTypeormRepository } from '../infrastructure/audit.typeorm.repository';

export const AUDIT_TIME_ZONE = Symbol('AUDIT_TIME_ZONE');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids que aparecen en los valores de los cambios (raza, madre, rol...). */
export function collectIds(entries: AuditEntry[]): string[] {
  const ids = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      if (UUID_RE.test(value)) ids.add(value.toLowerCase());
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    }
  };
  for (const e of entries) {
    e.animalIds.forEach((id) => ids.add(id));
    if (e.recordId && UUID_RE.test(e.recordId)) ids.add(e.recordId);
    for (const value of Object.values(e.changes ?? {})) visit(value);
  }
  return [...ids];
}

/**
 * Datos reservados: en el historial se ve que cambiaron, pero el valor solo lo
 * ve quien tenga alguno de los permisos indicados.
 */
const RESTRICTED_FIELDS: Record<string, Record<string, string[]>> = {
  animals: {
    price: [PERMISSIONS.ANIMALS_READ_PRICE, PERMISSIONS.ANIMALS_SET_PRICE],
  },
};

const HIDDEN = '[oculto]';

/** Oculta los valores de los datos reservados que el usuario no puede ver. */
export function redactRestricted(
  entry: AuditEntry,
  permissions: readonly string[],
): AuditEntry {
  const fields = RESTRICTED_FIELDS[entry.entity];
  if (!fields || !entry.changes) return entry;
  let changes: Record<string, unknown> | null = null;
  for (const [field, allowed] of Object.entries(fields)) {
    if (!(field in entry.changes)) continue;
    if (allowed.some((p) => permissions.includes(p))) continue;
    changes ??= { ...entry.changes };
    const value = changes[field];
    changes[field] = Array.isArray(value) ? [HIDDEN, HIDDEN] : HIDDEN;
  }
  return changes ? { ...entry, changes } : entry;
}

export interface AuditPage {
  items: (AuditEntry & { entityLabel: string; eventLabel: string | null })[];
  total: number;
  page: number;
  limit: number;
  refs: Record<string, AuditRef>;
}

@Injectable()
export class AuditService implements IAuditEvents {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly repository: AuditTypeormRepository,
    @Inject(AUDIT_TIME_ZONE) private readonly timeZone: string,
  ) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.repository.insertEvent(event, currentAuditContext());
    } catch (error) {
      // La acción ya se hizo: un fallo del registro no la deshace.
      this.logger.error(
        `No se pudo registrar ${event.event}: ${(error as Error).message}`,
      );
    }
  }

  /** viewerPermissions: permisos de quien consulta, para ocultar datos reservados. */
  async list(
    filters: AuditFilters,
    pagination: PaginationParams,
    viewerPermissions: readonly string[],
  ): Promise<AuditPage> {
    const page = await this.repository.find(filters, pagination, this.timeZone);
    const items = page.items.map((e) => redactRestricted(e, viewerPermissions));
    const refs = await this.repository.resolveRefs(collectIds(items));
    return {
      ...page,
      items: items.map((e) => ({
        ...e,
        entityLabel: AUDIT_ENTITY_LABELS[e.entity] ?? e.entity,
        eventLabel: e.event ? AUDIT_EVENT_LABELS[e.event] : null,
      })),
      refs,
    };
  }

  async animalActivity(
    animalId: string,
    filters: Pick<AuditFilters, 'action' | 'from' | 'to'>,
    pagination: PaginationParams,
    viewerPermissions: readonly string[],
  ): Promise<AuditPage> {
    if (!(await this.repository.animalExists(animalId))) {
      throw new NotFoundException('El animal no existe');
    }
    return this.list({ ...filters, animalId }, pagination, viewerPermissions);
  }

  entities() {
    return Object.entries(AUDIT_ENTITY_LABELS).map(([code, label]) => ({
      code,
      label,
    }));
  }
}
