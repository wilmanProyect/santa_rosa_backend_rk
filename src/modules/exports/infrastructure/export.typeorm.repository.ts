import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ExportFilters, ExportRow } from '../domain/export.types';

/** Arete y nombre de un animal, como se muestran en el sistema ("CSR-62 RAINHA"). */
const label = (alias: string) =>
  `nullif(concat_ws(' ', ${alias}.ear_tag, ${alias}.name), '')`;

/** Condiciones con parámetros numerados ($1, $2...). */
class Where {
  readonly parts: string[] = [];
  readonly params: unknown[] = [];

  add(sql: (p: string) => string, value: unknown): this {
    if (value === undefined) return this;
    this.params.push(value);
    this.parts.push(sql(`$${this.params.length}`));
    return this;
  }

  raw(sql: string): this {
    this.parts.push(sql);
    return this;
  }

  sql(): string {
    return this.parts.length ? `WHERE ${this.parts.join(' AND ')}` : '';
  }
}

/**
 * Consultas de solo lectura para la exportación a Excel. Devuelven todo lo que
 * cumple los filtros (sin paginar) y omiten los registros borrados.
 */
@Injectable()
export class ExportTypeormRepository {
  constructor(private readonly dataSource: DataSource) {}

  animals(filters: ExportFilters): Promise<ExportRow[]> {
    const where = new Where()
      .raw('a.deleted_at IS NULL')
      .add((p) => `a.species = ${p}`, filters.species)
      .add((p) => `a.status = ${p}`, filters.status);
    if (!filters.includeExternal) where.raw('NOT a.is_external');
    return this.dataSource.query<ExportRow[]>(
      `SELECT a.is_external, a.ear_tag, a.name, a.species, b.name AS breed, a.sex,
              c.name AS color, a.genetic_category, a.genetic_category_confirmed,
              a.absid_registry, a.absid_certificate_code, a.external_registry,
              a.birth_date::text, ${label('d')} AS dam, ${label('s')} AS sire,
              a.entry_origin, a.entry_date::text, a.source_farm,
              a.status, a.status_date::text, a.status_reason,
              bw.weight_kg AS birth_weight_kg,
              ww.weighed_at::text AS weaning_date, ww.weight_kg AS weaning_weight_kg,
              lw.weighed_at::text AS last_weighed_at, lw.weight_kg AS last_weight_kg,
              a.identifier_exception, a.identifier_exception_reason, a.notes, a.price
         FROM animals a
         JOIN breeds b ON b.id = a.breed_id
         LEFT JOIN animal_colors c ON c.id = a.color_id
         LEFT JOIN animals d ON d.id = a.dam_id
         LEFT JOIN animals s ON s.id = a.sire_id
         LEFT JOIN LATERAL (
           SELECT w.weight_kg FROM animal_weighings w
            WHERE w.animal_id = a.id AND w.type = 'BIRTH' AND w.deleted_at IS NULL
            LIMIT 1) bw ON true
         LEFT JOIN LATERAL (
           SELECT w.weighed_at, w.weight_kg FROM animal_weighings w
            WHERE w.animal_id = a.id AND w.type = 'WEANING' AND w.deleted_at IS NULL
            LIMIT 1) ww ON true
         LEFT JOIN LATERAL (
           SELECT w.weighed_at, w.weight_kg FROM animal_weighings w
            WHERE w.animal_id = a.id AND w.deleted_at IS NULL
            ORDER BY w.weighed_at DESC, w.created_at DESC LIMIT 1) lw ON true
         ${where.sql()}
        ORDER BY a.is_external, a.species, a.ear_tag NULLS LAST, a.name NULLS LAST`,
      where.params,
    );
  }

  health(filters: ExportFilters): Promise<ExportRow[]> {
    // Los eventos generales (limpieza de corral) no tienen animal: salen solo
    // si no se filtra por especie.
    const where = new Where()
      .raw('h.deleted_at IS NULL')
      .raw('(h.animal_id IS NULL OR a.deleted_at IS NULL)')
      .add((p) => `a.species = ${p}`, filters.species)
      .add((p) => `h.applied_at >= ${p}::date`, filters.from)
      .add((p) => `h.applied_at <= ${p}::date`, filters.to);
    return this.dataSource.query<ExportRow[]>(
      `SELECT h.applied_at::text, h.is_date_estimated, h.type,
              ${label('a')} AS animal, a.species, p.name AS product, h.product_batch,
              h.dose_quantity, h.dose_unit, h.route, h.target_condition,
              h.applied_by, h.location, h.next_dose_at::text,
              h.meat_withdrawal_days, h.milk_withdrawal_days, h.cost, h.notes
         FROM health_records h
         LEFT JOIN animals a ON a.id = h.animal_id
         LEFT JOIN veterinary_products p ON p.id = h.product_id
         ${where.sql()}
        ORDER BY h.applied_at DESC, a.ear_tag NULLS LAST`,
      where.params,
    );
  }

  services(filters: ExportFilters): Promise<ExportRow[]> {
    const where = new Where()
      .raw('s.deleted_at IS NULL')
      .add((p) => `s.species = ${p}`, filters.species)
      .add((p) => `s.service_date >= ${p}::date`, filters.from)
      .add((p) => `s.service_date <= ${p}::date`, filters.to);
    return this.dataSource.query<ExportRow[]>(
      `SELECT s.service_date::text, s.exit_date::text, s.species, s.type,
              ${label('d')} AS dam, ${label('m')} AS sire, m.is_external AS sire_external,
              s.straw_code, s.expected_birth_date::text, s.status,
              s.expected_offspring_category, s.inbreeding_coefficient,
              s.kinship_override_reason,
              lc.checked_at::text AS last_check_at, lc.method AS last_check_method,
              lc.result AS last_check_result, lc.fetus_count AS last_check_fetuses,
              bt.birth_date::text AS birth_date,
              s.abortion_date::text, s.abortion_cause,
              s.dam_death_date::text, s.dam_death_cause, s.notes
         FROM breeding_services s
         JOIN animals d ON d.id = s.dam_id
         JOIN animals m ON m.id = s.sire_id
         LEFT JOIN LATERAL (
           SELECT c.checked_at, c.method, c.result, c.fetus_count FROM pregnancy_checks c
            WHERE c.service_id = s.id AND c.deleted_at IS NULL
            ORDER BY c.checked_at DESC, c.created_at DESC LIMIT 1) lc ON true
         LEFT JOIN births bt ON bt.service_id = s.id AND bt.deleted_at IS NULL
         ${where.sql()}
        ORDER BY s.service_date DESC, d.ear_tag NULLS LAST`,
      where.params,
    );
  }

  checks(filters: ExportFilters): Promise<ExportRow[]> {
    const where = new Where()
      .raw('c.deleted_at IS NULL')
      .raw('s.deleted_at IS NULL')
      .add((p) => `s.species = ${p}`, filters.species)
      .add((p) => `c.checked_at >= ${p}::date`, filters.from)
      .add((p) => `c.checked_at <= ${p}::date`, filters.to);
    return this.dataSource.query<ExportRow[]>(
      `SELECT c.checked_at::text, ${label('d')} AS dam, ${label('m')} AS sire,
              s.service_date::text, s.species, c.method, c.result, c.fetus_count, c.notes
         FROM pregnancy_checks c
         JOIN breeding_services s ON s.id = c.service_id
         JOIN animals d ON d.id = s.dam_id
         JOIN animals m ON m.id = s.sire_id
         ${where.sql()}
        ORDER BY c.checked_at DESC, d.ear_tag NULLS LAST`,
      where.params,
    );
  }

  births(filters: ExportFilters): Promise<ExportRow[]> {
    const where = this.birthWhere(filters);
    return this.dataSource.query<ExportRow[]>(
      `SELECT bt.birth_date::text, bt.species, ${label('d')} AS dam, ${label('m')} AS sire,
              s.service_date::text, bt.assistance, bt.is_historical,
              (SELECT count(*)::int FROM birth_offspring o WHERE o.birth_id = bt.id) AS offspring,
              (SELECT count(*)::int FROM birth_offspring o WHERE o.birth_id = bt.id AND o.born_alive) AS born_alive,
              bt.notes
         FROM births bt
         JOIN animals d ON d.id = bt.dam_id
         LEFT JOIN animals m ON m.id = bt.sire_id
         LEFT JOIN breeding_services s ON s.id = bt.service_id
         ${where.sql()}
        ORDER BY bt.birth_date DESC, d.ear_tag NULLS LAST`,
      where.params,
    );
  }

  offspring(filters: ExportFilters): Promise<ExportRow[]> {
    const where = this.birthWhere(filters);
    return this.dataSource.query<ExportRow[]>(
      `SELECT bt.birth_date::text, ${label('d')} AS dam, ${label('m')} AS sire,
              o.position, o.sex, o.born_alive, o.birth_weight_kg,
              ${label('k')} AS animal, k.status AS animal_status
         FROM birth_offspring o
         JOIN births bt ON bt.id = o.birth_id
         JOIN animals d ON d.id = bt.dam_id
         LEFT JOIN animals m ON m.id = bt.sire_id
         LEFT JOIN animals k ON k.id = o.animal_id AND k.deleted_at IS NULL
         ${where.sql()}
        ORDER BY bt.birth_date DESC, d.ear_tag NULLS LAST, o.position`,
      where.params,
    );
  }

  private birthWhere(filters: ExportFilters): Where {
    return new Where()
      .raw('bt.deleted_at IS NULL')
      .add((p) => `bt.species = ${p}`, filters.species)
      .add((p) => `bt.birth_date >= ${p}::date`, filters.from)
      .add((p) => `bt.birth_date <= ${p}::date`, filters.to);
  }
}
