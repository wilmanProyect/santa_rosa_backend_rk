import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import {
  AUDIT_EVENTS,
  AuditEventType,
} from '@shared/application/ports/audit-events.interface';
import type { IAuditEvents } from '@shared/application/ports/audit-events.interface';
import {
  SPECIES_LABEL,
  STATUS_LABEL,
} from '@modules/animals/infrastructure/certificates/certificate-labels';
import {
  EXPORT_SECTION_LABELS,
  ExportData,
  ExportFilters,
  ExportSection,
} from '../domain/export.types';
import { ExportTypeormRepository } from '../infrastructure/export.typeorm.repository';
import { XlsxExportBuilder } from '../infrastructure/xlsx-export.builder';

export const EXPORT_TIME_ZONE = Symbol('EXPORT_TIME_ZONE');

/** Permiso de lectura que exige cada sección, además de exports:download. */
export const SECTION_PERMISSION: Record<ExportSection, string> = {
  [ExportSection.ANIMALS]: PERMISSIONS.ANIMALS_READ,
  [ExportSection.HEALTH]: PERMISSIONS.HEALTH_READ,
  [ExportSection.SERVICES]: PERMISSIONS.REPRODUCTION_READ,
  [ExportSection.BIRTHS]: PERMISSIONS.REPRODUCTION_READ,
};

export interface ExportViewer {
  username: string;
  permissions: readonly string[];
}

export interface ExportResult {
  content: Buffer;
  fileName: string;
}

/**
 * Secciones a exportar: las pedidas (todas deben estar permitidas) o, si no se
 * indica ninguna, todas las que el usuario puede ver.
 */
export function resolveSections(
  requested: ExportSection[] | undefined,
  permissions: readonly string[],
): ExportSection[] {
  const allowed = (s: ExportSection) =>
    permissions.includes(SECTION_PERMISSION[s]);
  if (requested?.length) {
    const denied = requested.filter((s) => !allowed(s));
    if (denied.length) {
      throw new ForbiddenException(
        `No tiene permiso para exportar: ${denied.map((s) => EXPORT_SECTION_LABELS[s]).join(', ')}`,
      );
    }
    return Object.values(ExportSection).filter((s) => requested.includes(s));
  }
  const sections = Object.values(ExportSection).filter(allowed);
  if (!sections.length) {
    throw new ForbiddenException('No tiene permiso para ver ninguna sección');
  }
  return sections;
}

@Injectable()
export class ExportService {
  constructor(
    private readonly repository: ExportTypeormRepository,
    private readonly builder: XlsxExportBuilder,
    @Inject(AUDIT_EVENTS) private readonly auditEvents: IAuditEvents,
    @Inject(EXPORT_TIME_ZONE) private readonly timeZone: string,
  ) {}

  async exportWorkbook(
    viewer: ExportViewer,
    requested: ExportSection[] | undefined,
    filters: ExportFilters,
  ): Promise<ExportResult> {
    if (filters.from && filters.to && filters.from > filters.to) {
      throw new BadRequestException('from no puede ser posterior a to');
    }
    const sections = resolveSections(requested, viewer.permissions);
    const has = (s: ExportSection) => sections.includes(s);
    const showPrice =
      viewer.permissions.includes(PERMISSIONS.ANIMALS_READ_PRICE) ||
      viewer.permissions.includes(PERMISSIONS.ANIMALS_SET_PRICE);

    const [animals, health, services, checks, births, offspring] =
      await Promise.all([
        has(ExportSection.ANIMALS) ? this.repository.animals(filters) : null,
        has(ExportSection.HEALTH) ? this.repository.health(filters) : null,
        has(ExportSection.SERVICES) ? this.repository.services(filters) : null,
        has(ExportSection.SERVICES) ? this.repository.checks(filters) : null,
        has(ExportSection.BIRTHS) ? this.repository.births(filters) : null,
        has(ExportSection.BIRTHS) ? this.repository.offspring(filters) : null,
      ]);
    const data: ExportData = {
      animals: animals ?? undefined,
      health: health ?? undefined,
      services: services ?? undefined,
      checks: checks ?? undefined,
      births: births ?? undefined,
      offspring: offspring ?? undefined,
    };

    const now = new Date();
    const content = await this.builder.build(data, {
      generatedAt: now,
      timeZone: this.timeZone,
      generatedBy: viewer.username,
      filters: describeFilters(filters),
      showPrice,
    });

    const counts: Record<string, number> = {};
    for (const [key, rows] of Object.entries(data) as [
      string,
      unknown[] | undefined,
    ][]) {
      if (rows) counts[key] = rows.length;
    }
    await this.auditEvents.record({
      event: AuditEventType.DATA_EXPORTED,
      entity: 'system',
      summary:
        `Exportó a Excel: ${sections.map((s) => EXPORT_SECTION_LABELS[s]).join(', ')}`.slice(
          0,
          300,
        ),
      details: { sections, filters, rows: counts, withPrice: showPrice },
    });

    return {
      content,
      fileName: `santa-rosa-datos-${stamp(now, this.timeZone)}.xlsx`,
    };
  }
}

function describeFilters(filters: ExportFilters): [string, string][] {
  const out: [string, string][] = [];
  out.push([
    'Especie',
    filters.species ? SPECIES_LABEL[filters.species] : 'Todas',
  ]);
  if (filters.from || filters.to) {
    out.push([
      'Fechas (sanidad, montas y partos)',
      `${filters.from ? dmy(filters.from) : 'inicio'} a ${filters.to ? dmy(filters.to) : 'hoy'}`,
    ]);
  }
  out.push([
    'Estado de los animales',
    filters.status ? STATUS_LABEL[filters.status] : 'Todos',
  ]);
  out.push([
    'Reproductores externos',
    filters.includeExternal ? 'Incluidos' : 'No incluidos',
  ]);
  return out;
}

const dmy = (date: string) => date.split('-').reverse().join('/');

/** 20261125-1530 en la hora de la cabaña. */
function stamp(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}
