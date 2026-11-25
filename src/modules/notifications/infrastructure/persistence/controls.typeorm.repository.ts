import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { escapeLike } from '@shared/infrastructure/persistence/escape-like';
import {
  HealthCategory,
  typesOfCategory,
} from '@modules/animals/domain/models/health-record.model';
import { WeighingType } from '@modules/animals/domain/models/animal-weighing.model';
import {
  addDays,
  daysBetween,
} from '@modules/animals/domain/models/animal-event-date';
import { ControlType } from '../../domain/notification.enums';
import type { NotificationSettings } from '../../domain/notification-rules';
import {
  ControlCounts,
  ControlItem,
  ControlQuery,
  IControlsRepository,
  JustificationRow,
  UpcomingBirthRow,
} from '../../domain/notifications.repository.interface';

interface ControlDbRow {
  animal_id: string;
  ear_tag: string | null;
  name: string | null;
  species: string;
  sex: string;
  birth_date: string | null;
  last_date: string | null;
  base_due: string;
  due: string;
  j_reason: string | null;
  j_next: string | null;
  j_created_at: Date | null;
  j_created_by: string | null;
  total: string;
}

const SANITARY_TYPES = typesOfCategory(HealthCategory.SANITARY);

/**
 * Vencimiento de cada control, por animal vivo de la cabaña:
 *
 *  - Peso:     último pesaje (o nacimiento, o ingreso) + N meses.
 *  - Sanidad:  último registro sanitario (o nacimiento, o ingreso) + N meses.
 *  - Destete:  nacimiento + N meses, si no tiene pesaje de destete y nació
 *              desde la fecha de seguimiento.
 *
 * Una justificación vale para el vencimiento que respondió (resolved_due_date):
 * lo reprograma a next_due_date, o cierra el destete si next_due_date es null.
 * Cuando se registra el control, el vencimiento cambia y la justificación deja
 * de aplicarse sola.
 *
 * Devuelve el SQL y sus parámetros: $1 tipo, $2 meses; luego los propios.
 */
function controlsSql(
  type: ControlType,
  settings: NotificationSettings,
): { sql: string; params: unknown[] } {
  const params: unknown[] = [type];
  let lastExpr = 'NULL::date';
  let extra = '';
  let months: number;
  if (type === ControlType.WEIGHING) {
    months = settings.weighingIntervalMonths;
    lastExpr = `(SELECT max(w.weighed_at) FROM animal_weighings w
                  WHERE w.animal_id = a.id AND w.deleted_at IS NULL)`;
  } else if (type === ControlType.HEALTH) {
    months = settings.healthIntervalMonths;
    params.push(SANITARY_TYPES);
    lastExpr = `(SELECT max(h.applied_at) FROM health_records h
                  WHERE h.animal_id = a.id AND h.deleted_at IS NULL
                    AND h.type = ANY($3::text[]))`;
  } else {
    months = settings.weaningAgeMonths;
    params.push(settings.weaningTrackingFrom, WeighingType.WEANING);
    extra = `AND a.birth_date IS NOT NULL AND a.birth_date >= $3::date
             AND NOT EXISTS (SELECT 1 FROM animal_weighings w
                              WHERE w.animal_id = a.id AND w.deleted_at IS NULL
                                AND w.type = $4)`;
  }
  params.splice(1, 0, months);
  // Tras el splice: $1 tipo, $2 meses, $3... los del tipo.
  const sql = `
    WITH base AS (
      SELECT a.id, a.ear_tag, a.name, a.species, a.sex,
             to_char(a.birth_date, 'YYYY-MM-DD') AS birth_date,
             ${lastExpr} AS last_date,
             (COALESCE(${lastExpr}, a.birth_date, a.entry_date,
                       (a.created_at AT TIME ZONE 'America/La_Paz')::date)
               + make_interval(months => $2))::date AS base_due
        FROM animals a
       WHERE a.deleted_at IS NULL AND NOT a.is_external AND a.status = 'ALIVE'
         ${extra}
    ), j AS (
      SELECT DISTINCT ON (cj.animal_id) cj.animal_id, cj.reason, cj.next_due_date,
             cj.created_at, cj.created_by
        FROM control_justifications cj
        JOIN base b ON b.id = cj.animal_id AND cj.resolved_due_date = b.base_due
       WHERE cj.control_type = $1
       ORDER BY cj.animal_id, cj.created_at DESC
    ), c AS (
      SELECT b.id AS animal_id, b.ear_tag, b.name, b.species, b.sex, b.birth_date,
             to_char(b.last_date, 'YYYY-MM-DD') AS last_date,
             b.base_due,
             CASE WHEN j.animal_id IS NULL THEN b.base_due ELSE j.next_due_date END AS due,
             j.reason AS j_reason, j.next_due_date AS j_next,
             j.created_at AS j_created_at, j.created_by AS j_created_by
        FROM base b LEFT JOIN j ON j.animal_id = b.id
       -- Destete cerrado con justificación (no se destetará o ya se destetó).
       WHERE NOT (j.animal_id IS NOT NULL AND j.next_due_date IS NULL)
    )`;
  return { sql, params };
}

@Injectable()
export class ControlsTypeormRepository implements IControlsRepository {
  constructor(private readonly db: DataSource) {}

  async find(
    query: ControlQuery,
    pagination?: PaginationParams,
  ): Promise<Paginated<ControlItem>> {
    const { sql, params } = controlsSql(query.type, query.settings);
    const where: string[] = [];
    const p = (value: unknown) => {
      params.push(value);
      return `$${params.length}`;
    };
    // Solo se envían los parámetros que se usan: PostgreSQL rechaza los que
    // no aparecen en la consulta (no puede deducir su tipo).
    const today = () => `${p(query.today)}::date`;
    const horizon = () =>
      `${p(addDays(query.today, query.settings.upcomingDays))}::date`;
    switch (query.state) {
      case 'OVERDUE':
        where.push(`due < ${today()}`);
        break;
      case 'TODAY':
        where.push(`due = ${today()}`);
        break;
      case 'UPCOMING':
        where.push(`due > ${today()} AND due <= ${horizon()}`);
        break;
      case 'PENDING':
        where.push(`due <= ${horizon()}`);
        break;
      case 'LATER':
        where.push(`due > ${horizon()}`);
        break;
    }
    if (query.animalIds)
      where.push(`animal_id = ANY(${p(query.animalIds)}::uuid[])`);
    if (query.search?.trim()) {
      const term = p(`%${escapeLike(query.search.trim())}%`);
      where.push(`(ear_tag ILIKE ${term} OR name ILIKE ${term})`);
    }
    const limit = pagination
      ? `LIMIT ${p(pagination.limit)} OFFSET ${p((pagination.page - 1) * pagination.limit)}`
      : '';
    const rows = await this.db.query<ControlDbRow[]>(
      `${sql}
       SELECT c.animal_id, c.ear_tag, c.name, c.species, c.sex, c.birth_date,
              c.last_date, c.j_reason, c.j_created_at, c.j_created_by,
              to_char(c.base_due, 'YYYY-MM-DD') AS base_due,
              to_char(c.due, 'YYYY-MM-DD') AS due,
              to_char(c.j_next, 'YYYY-MM-DD') AS j_next,
              COUNT(*) OVER () AS total
         FROM c ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY c.due, c.ear_tag NULLS LAST, c.animal_id
        ${limit}`,
      params,
    );
    const items = rows.map((r): ControlItem => {
      const daysOverdue = Math.max(0, daysBetween(r.due, query.today));
      const upcomingLimit = addDays(query.today, query.settings.upcomingDays);
      return {
        animalId: r.animal_id,
        earTag: r.ear_tag,
        name: r.name,
        species: r.species,
        sex: r.sex,
        birthDate: r.birth_date,
        lastDate: r.last_date,
        baseDueDate: r.base_due,
        dueDate: r.due,
        state:
          r.due < query.today
            ? 'OVERDUE'
            : r.due === query.today
              ? 'TODAY'
              : r.due <= upcomingLimit
                ? 'UPCOMING'
                : 'LATER',
        daysOverdue,
        justification: r.j_reason
          ? {
              reason: r.j_reason,
              nextDueDate: r.j_next,
              createdAt: r.j_created_at!,
              createdBy: r.j_created_by,
            }
          : null,
      };
    });
    return {
      items,
      total: rows.length ? Number(rows[0].total) : 0,
      page: pagination?.page ?? 1,
      limit: pagination?.limit ?? items.length,
    };
  }

  async counts(
    type: ControlType,
    settings: NotificationSettings,
    today: string,
  ): Promise<ControlCounts> {
    const { sql, params } = controlsSql(type, settings);
    params.push(
      today,
      addDays(today, settings.upcomingDays),
      addDays(today, -1),
    );
    const n = params.length;
    const [r] = await this.db.query<Record<keyof ControlCounts, string>[]>(
      `${sql}
       SELECT COUNT(*) FILTER (WHERE due < $${n - 2}::date) AS "overdue",
              COUNT(*) FILTER (WHERE due = $${n - 2}::date) AS "today",
              COUNT(*) FILTER (WHERE due > $${n - 2}::date AND due <= $${n - 1}::date) AS "upcoming",
              COUNT(*) FILTER (WHERE due = $${n - 1}::date) AS "enteringUpcoming",
              COUNT(*) FILTER (WHERE due = $${n}::date) AS "newlyOverdue"
         FROM c`,
      params,
    );
    return {
      overdue: Number(r.overdue),
      today: Number(r.today),
      upcoming: Number(r.upcoming),
      enteringUpcoming: Number(r.enteringUpcoming),
      newlyOverdue: Number(r.newlyOverdue),
    };
  }

  async insertJustifications(
    rows: {
      animalId: string;
      type: ControlType;
      resolvedDueDate: string;
      nextDueDate: string | null;
      reason: string;
      createdBy: string;
    }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.db.transaction(async (manager) => {
      for (const r of rows) {
        await manager.query(
          `INSERT INTO control_justifications
             (id, animal_id, control_type, resolved_due_date, next_due_date, reason, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            randomUUID(),
            r.animalId,
            r.type,
            r.resolvedDueDate,
            r.nextDueDate,
            r.reason,
            r.createdBy,
          ],
        );
      }
    });
  }

  async justifications(filters: {
    animalId?: string;
    type?: ControlType;
  }): Promise<JustificationRow[]> {
    const rows = await this.db.query<
      {
        id: string;
        animal_id: string;
        control_type: ControlType;
        resolved_due_date: string;
        next_due_date: string | null;
        reason: string;
        created_at: Date;
        created_by: string | null;
        created_by_name: string | null;
      }[]
    >(
      `SELECT cj.id, cj.animal_id, cj.control_type,
              to_char(cj.resolved_due_date, 'YYYY-MM-DD') AS resolved_due_date,
              to_char(cj.next_due_date, 'YYYY-MM-DD') AS next_due_date,
              cj.reason, cj.created_at, cj.created_by,
              NULLIF(concat_ws(' ', u.first_name, u.paternal_last_name), '') AS created_by_name
         FROM control_justifications cj
         LEFT JOIN users u ON u.id = cj.created_by
        WHERE ($1::uuid IS NULL OR cj.animal_id = $1)
          AND ($2::text IS NULL OR cj.control_type = $2)
        ORDER BY cj.created_at DESC
        LIMIT 200`,
      [filters.animalId ?? null, filters.type ?? null],
    );
    return rows.map((r) => ({
      id: r.id,
      animalId: r.animal_id,
      type: r.control_type,
      resolvedDueDate: r.resolved_due_date,
      nextDueDate: r.next_due_date,
      reason: r.reason,
      createdAt: r.created_at,
      createdBy: r.created_by,
      createdByName: r.created_by_name,
    }));
  }

  async upcomingBirths(from: string, to: string): Promise<UpcomingBirthRow[]> {
    const rows = await this.db.query<
      {
        service_id: string;
        expected_birth_date: string;
        status: string;
        dam_ear_tag: string | null;
        dam_name: string | null;
        sire_ear_tag: string | null;
        sire_name: string | null;
        fetus_count: number | null;
      }[]
    >(
      `SELECT s.id AS service_id,
              to_char(s.expected_birth_date, 'YYYY-MM-DD') AS expected_birth_date,
              s.status, d.ear_tag AS dam_ear_tag, d.name AS dam_name,
              si.ear_tag AS sire_ear_tag, si.name AS sire_name,
              (SELECT c.fetus_count FROM pregnancy_checks c
                WHERE c.service_id = s.id AND c.deleted_at IS NULL
                ORDER BY c.checked_at DESC, c.created_at DESC LIMIT 1) AS fetus_count
         FROM breeding_services s
         JOIN animals d ON d.id = s.dam_id
         JOIN animals si ON si.id = s.sire_id
        WHERE s.deleted_at IS NULL AND s.status IN ('PENDING', 'PREGNANT')
          AND d.status = 'ALIVE' AND d.deleted_at IS NULL
          AND s.expected_birth_date BETWEEN $1 AND $2
        ORDER BY s.expected_birth_date, d.ear_tag`,
      [from, to],
    );
    return rows.map((r) => ({
      serviceId: r.service_id,
      expectedBirthDate: r.expected_birth_date,
      status: r.status,
      damEarTag: r.dam_ear_tag,
      damName: r.dam_name,
      sireEarTag: r.sire_ear_tag,
      sireName: r.sire_name,
      fetusCount: r.fetus_count,
    }));
  }
}
