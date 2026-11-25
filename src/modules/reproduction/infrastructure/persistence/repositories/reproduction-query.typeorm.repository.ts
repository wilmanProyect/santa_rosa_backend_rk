import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  AnimalStatus,
  GeneticCategory,
  Sex,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import { PedigreeAnimal } from '../../../domain/pedigree-tree';
import { daysBetween } from '@modules/animals/domain/models/animal-event-date';
import {
  IReproductionQueryRepository,
  PendingPregnancyCheck,
  ReproductionStats,
  SireStats,
  StatsFilters,
  UpcomingBirth,
} from '../../../domain/repositories/reproduction.repository.interface';
import {
  PREGNANCY_CHECK_DAYS,
  ServiceStatus,
  ServiceType,
} from '../../../domain/enums/reproduction.enums';
import { PedigreeNode } from '../../../domain/kinship';

type AnimalRow = { id: string; ear_tag: string | null; name: string | null };
const animal = (prefix: string, r: Record<string, string | null>) => ({
  id: r[`${prefix}_id`]!,
  earTag: r[`${prefix}_ear_tag`],
  name: r[`${prefix}_name`],
});

@Injectable()
export class ReproductionQueryTypeormRepository implements IReproductionQueryRepository {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async loadPedigree(
    ids: string[],
    generations: number,
  ): Promise<PedigreeNode[]> {
    // UNION (sin ALL) descarta filas repetidas; la profundidad corta la recursión.
    const rows: (AnimalRow & {
      sex: Sex;
      dam_id: string | null;
      sire_id: string | null;
    })[] = await this.db.query(
      `WITH RECURSIVE tree AS (
         SELECT id, dam_id, sire_id, 0 AS depth FROM animals
          WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
         UNION
         SELECT a.id, a.dam_id, a.sire_id, t.depth + 1 FROM animals a
           JOIN tree t ON a.id = t.dam_id OR a.id = t.sire_id
          WHERE t.depth < $2 AND a.deleted_at IS NULL
       )
       SELECT DISTINCT a.id, a.ear_tag, a.name, a.sex, a.dam_id, a.sire_id
         FROM tree JOIN animals a ON a.id = tree.id`,
      [ids, generations],
    );
    return rows.map((r) => ({
      id: r.id,
      earTag: r.ear_tag,
      name: r.name,
      sex: r.sex,
      damId: r.dam_id,
      sireId: r.sire_id,
    }));
  }

  async loadPedigreeDetails(
    id: string,
    generations: number,
  ): Promise<PedigreeAnimal[]> {
    const rows: {
      id: string;
      ear_tag: string | null;
      name: string | null;
      sex: Sex;
      species: Species;
      birth_date: string | null;
      is_external: boolean;
      status: AnimalStatus;
      genetic_category: GeneticCategory | null;
      absid_registry: string | null;
      breed_name: string | null;
      dam_id: string | null;
      sire_id: string | null;
    }[] = await this.db.query(
      `WITH RECURSIVE tree AS (
         SELECT id, dam_id, sire_id, 0 AS depth FROM animals
          WHERE id = $1 AND deleted_at IS NULL
         UNION
         SELECT a.id, a.dam_id, a.sire_id, t.depth + 1 FROM animals a
           JOIN tree t ON a.id = t.dam_id OR a.id = t.sire_id
          WHERE t.depth < $2 AND a.deleted_at IS NULL
       )
       SELECT DISTINCT a.id, a.ear_tag, a.name, a.sex, a.species,
              to_char(a.birth_date, 'YYYY-MM-DD') AS birth_date,
              a.is_external, a.status, a.genetic_category, a.absid_registry,
              b.name AS breed_name, a.dam_id, a.sire_id
         FROM tree
         JOIN animals a ON a.id = tree.id
         LEFT JOIN breeds b ON b.id = a.breed_id`,
      [id, generations],
    );
    return rows.map((r) => ({
      id: r.id,
      earTag: r.ear_tag,
      name: r.name,
      sex: r.sex,
      species: r.species,
      birthDate: r.birth_date,
      isExternal: r.is_external,
      status: r.status,
      geneticCategory: r.genetic_category,
      absidRegistry: r.absid_registry,
      breedName: r.breed_name,
      damId: r.dam_id,
      sireId: r.sire_id,
    }));
  }

  async stats(filters: StatsFilters): Promise<ReproductionStats> {
    const params = [
      filters.species ?? null,
      filters.from ?? null,
      filters.to ?? null,
    ];
    /** Filtro por especie y período sobre la columna de fecha indicada. */
    const period = (alias: string, column: string) =>
      `($1::text IS NULL OR ${alias}.species = $1) AND ($2::date IS NULL OR ${alias}.${column} >= $2) AND ($3::date IS NULL OR ${alias}.${column} <= $3)`;

    const serviceRows: {
      status: ServiceStatus;
      type: ServiceType;
      total: string;
      overrides: string;
      died_pregnant: string;
      lost_fetuses: string;
    }[] = await this.db.query(
      `SELECT status, type, COUNT(*) AS total,
              COUNT(*) FILTER (WHERE kinship_override_by IS NOT NULL) AS overrides,
              COUNT(*) FILTER (WHERE dam_death_confirmed_pregnancy) AS died_pregnant,
              COALESCE(SUM(dam_death_lost_fetuses), 0) AS lost_fetuses
         FROM breeding_services s
        WHERE deleted_at IS NULL AND ${period('s', 'service_date')}
        GROUP BY status, type`,
      params,
    );
    const byStatus = Object.fromEntries(
      Object.values(ServiceStatus).map((s) => [s, 0]),
    ) as Record<ServiceStatus, number>;
    const byType = Object.fromEntries(
      Object.values(ServiceType).map((t) => [t, 0]),
    ) as Record<ServiceType, number>;
    let overrides = 0;
    let diedPregnant = 0;
    let lostFetuses = 0;
    for (const r of serviceRows) {
      byStatus[r.status] += Number(r.total);
      byType[r.type] += Number(r.total);
      overrides += Number(r.overrides);
      diedPregnant += Number(r.died_pregnant);
      lostFetuses += Number(r.lost_fetuses);
    }
    const damDeaths = byStatus[ServiceStatus.DAM_DIED];
    const totalServices = Object.values(byStatus).reduce((a, b) => a + b, 0);

    const birthRows: {
      is_historical: boolean;
      litter: string;
      alive: string;
    }[] = await this.db.query(
      `SELECT b.is_historical, COUNT(o.id) AS litter,
              COUNT(o.id) FILTER (WHERE o.born_alive) AS alive
         FROM births b JOIN birth_offspring o ON o.birth_id = b.id
        WHERE b.deleted_at IS NULL AND ${period('b', 'birth_date')}
        GROUP BY b.id, b.is_historical`,
      params,
    );
    const byLitterSize = { '1': 0, '2': 0, '3': 0, '4': 0 };
    let offspring = 0;
    let bornAlive = 0;
    for (const r of birthRows) {
      const litter = Number(r.litter);
      const key = String(Math.min(litter, 4)) as keyof typeof byLitterSize;
      byLitterSize[key]++;
      offspring += litter;
      bornAlive += Number(r.alive);
    }

    // Intervalo entre partos: se cuentan los partos del período que tienen
    // un parto anterior de la misma madre (aunque ese sea de antes).
    const intervalRows: { dam_id: string; birth_date: string }[] =
      await this.db.query(
        `SELECT dam_id, to_char(birth_date, 'YYYY-MM-DD') AS birth_date
           FROM births
          WHERE deleted_at IS NULL AND ($1::text IS NULL OR species = $1)
            AND ($2::date IS NULL OR birth_date <= $2)
          ORDER BY dam_id, birth_date`,
        [filters.species ?? null, filters.to ?? null],
      );
    const intervals: number[] = [];
    for (let i = 1; i < intervalRows.length; i++) {
      const prev = intervalRows[i - 1];
      const cur = intervalRows[i];
      if (prev.dam_id !== cur.dam_id) continue;
      if (filters.from && cur.birth_date < filters.from) continue;
      intervals.push(daysBetween(prev.birth_date, cur.birth_date));
    }

    return {
      services: {
        total: totalServices,
        byStatus,
        byType,
        // Una madre que murió sin diagnóstico no dice si la monta funcionó.
        withResult:
          totalServices -
          byStatus[ServiceStatus.PENDING] -
          (damDeaths - diedPregnant),
        conceptions:
          byStatus[ServiceStatus.PREGNANT] +
          byStatus[ServiceStatus.BIRTHED] +
          byStatus[ServiceStatus.ABORTED] +
          diedPregnant,
        kinshipOverrides: overrides,
        damDeaths: {
          total: damDeaths,
          confirmedPregnant: diedPregnant,
          lostFetuses,
        },
      },
      births: {
        total: birthRows.length,
        historical: birthRows.filter((r) => r.is_historical).length,
        byLitterSize,
        offspring,
        bornAlive,
        bornDead: offspring - bornAlive,
        averageIntervalDays: intervals.length
          ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
          : null,
        intervalsCounted: intervals.length,
      },
      sires: await this.sireStats(params, period),
    };
  }

  private async sireStats(
    params: (string | null)[],
    period: (alias: string, column: string) => string,
  ): Promise<SireStats[]> {
    const rows: (Record<string, string | null> & {
      services: string;
      with_result: string;
      conceptions: string;
      births: string;
      offspring: string;
      born_alive: string;
    })[] = await this.db.query(
      `WITH s AS (
         SELECT sire_id,
                COUNT(*) AS services,
                COUNT(*) FILTER (WHERE status <> 'PENDING'
                  AND NOT (status = 'DAM_DIED' AND NOT dam_death_confirmed_pregnancy)) AS with_result,
                COUNT(*) FILTER (WHERE status IN ('PREGNANT', 'BIRTHED', 'ABORTED')
                  OR dam_death_confirmed_pregnancy) AS conceptions
           FROM breeding_services s
          WHERE deleted_at IS NULL AND ${period('s', 'service_date')}
          GROUP BY sire_id
       ), b AS (
         SELECT b.sire_id, COUNT(DISTINCT b.id) AS births, COUNT(o.id) AS offspring,
                COUNT(o.id) FILTER (WHERE o.born_alive) AS born_alive
           FROM births b JOIN birth_offspring o ON o.birth_id = b.id
          WHERE b.deleted_at IS NULL AND b.sire_id IS NOT NULL
            AND ${period('b', 'birth_date')}
          GROUP BY b.sire_id
       )
       SELECT a.id AS sire_id, a.ear_tag AS sire_ear_tag, a.name AS sire_name,
              COALESCE(s.services, 0) AS services, COALESCE(s.with_result, 0) AS with_result,
              COALESCE(s.conceptions, 0) AS conceptions, COALESCE(b.births, 0) AS births,
              COALESCE(b.offspring, 0) AS offspring, COALESCE(b.born_alive, 0) AS born_alive
         FROM s FULL JOIN b ON b.sire_id = s.sire_id
         JOIN animals a ON a.id = COALESCE(s.sire_id, b.sire_id)
        ORDER BY COALESCE(b.offspring, 0) DESC, COALESCE(s.services, 0) DESC, a.ear_tag`,
      params,
    );
    return rows.map((r) => ({
      sire: animal('sire', r),
      services: Number(r.services),
      servicesWithResult: Number(r.with_result),
      conceptions: Number(r.conceptions),
      births: Number(r.births),
      offspring: Number(r.offspring),
      bornAlive: Number(r.born_alive),
    }));
  }

  async pendingPregnancyChecks(
    until: string,
  ): Promise<PendingPregnancyCheck[]> {
    const rows: Record<string, string | null>[] = await this.db.query(
      `SELECT s.id, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
              to_char(s.service_date + $2::int, 'YYYY-MM-DD') AS check_from,
              d.id AS dam_id, d.ear_tag AS dam_ear_tag, d.name AS dam_name,
              m.id AS sire_id, m.ear_tag AS sire_ear_tag, m.name AS sire_name
         FROM breeding_services s
         JOIN animals d ON d.id = s.dam_id
         JOIN animals m ON m.id = s.sire_id
        WHERE s.deleted_at IS NULL AND s.status = 'PENDING'
          AND s.service_date + $2::int <= $1::date
        ORDER BY s.service_date, d.ear_tag`,
      [until, PREGNANCY_CHECK_DAYS.from],
    );
    return rows.map((r) => ({
      serviceId: r.id!,
      dam: animal('dam', r),
      sire: animal('sire', r),
      serviceDate: r.service_date!,
      checkFrom: r.check_from!,
    }));
  }

  async upcomingBirths(until: string): Promise<UpcomingBirth[]> {
    const rows: Record<string, string | null>[] = await this.db.query(
      `SELECT s.id, s.status, to_char(s.service_date, 'YYYY-MM-DD') AS service_date,
              to_char(s.expected_birth_date, 'YYYY-MM-DD') AS expected_birth_date,
              last.fetus_count,
              d.id AS dam_id, d.ear_tag AS dam_ear_tag, d.name AS dam_name,
              m.id AS sire_id, m.ear_tag AS sire_ear_tag, m.name AS sire_name
         FROM breeding_services s
         JOIN animals d ON d.id = s.dam_id
         JOIN animals m ON m.id = s.sire_id
         LEFT JOIN LATERAL (
           SELECT c.fetus_count FROM pregnancy_checks c
            WHERE c.service_id = s.id AND c.deleted_at IS NULL
            ORDER BY c.checked_at DESC, c.created_at DESC LIMIT 1
         ) last ON true
        WHERE s.deleted_at IS NULL AND s.status IN ('PENDING', 'PREGNANT')
          AND s.expected_birth_date <= $1::date
        ORDER BY s.expected_birth_date, d.ear_tag`,
      [until],
    );
    return rows.map((r) => ({
      serviceId: r.id!,
      dam: animal('dam', r),
      sire: animal('sire', r),
      serviceDate: r.service_date!,
      status: r.status as ServiceStatus,
      expectedBirthDate: r.expected_birth_date!,
      expectedFetusCount: r.fetus_count === null ? null : Number(r.fetus_count),
    }));
  }
}
