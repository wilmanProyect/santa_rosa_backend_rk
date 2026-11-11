import { Inject, Injectable } from '@nestjs/common';
import { toDateOnly } from '@shared/domain/date-only';
import { Sex } from '@modules/animals/domain/enums/animal.enums';
import { addDays } from '@modules/animals/domain/models/animal-event-date';
import { GetAnimalUseCase } from '@modules/animals/application/use-cases/animals/get-animal.use-case';
import {
  BIRTH_REPOSITORY,
  BREEDING_SERVICE_REPOSITORY,
  REPRODUCTION_QUERY_REPOSITORY,
} from '../../domain/repositories/reproduction.repository.interface';
import type {
  IBirthRepository,
  IBreedingServiceRepository,
  IReproductionQueryRepository,
  PendingPregnancyCheck,
  ReproductionStats,
  StatsFilters,
  UpcomingBirth,
} from '../../domain/repositories/reproduction.repository.interface';
import {
  OPEN_SERVICE_STATUSES,
  PREGNANCY_CHECK_DAYS,
} from '../../domain/enums/reproduction.enums';
import { BreedingService } from '../../domain/models/breeding-service.model';
import { Birth } from '../../domain/models/birth.model';

/** Tope de montas y partos que se devuelven en el historial de un animal. */
const HISTORY_LIMIT = 500;

/** Por defecto, partos probables de los próximos 15 días. */
const UPCOMING_BIRTH_DAYS = 15;
/** Por defecto, diagnósticos que corresponden en los próximos 7 días. */
const UPCOMING_CHECK_DAYS = 7;

const rate = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 1000) / 10 : null;

export interface AnimalReproduction {
  /** Montas en las que el animal es madre o padre (más reciente primero). */
  services: BreedingService[];
  /** Partos en los que es madre o padre, y el parto en el que nació. */
  births: Birth[];
  summary: {
    births: number;
    offspring: number;
    bornAlive: number;
    multipleBirths: number;
    /** Crías por parto. */
    averageLitterSize: number | null;
    lastBirthDate: string | null;
    /** Monta abierta (hembra preñada o sin diagnóstico). */
    openService: BreedingService | null;
  };
}

@Injectable()
export class ReproductionReportsService {
  constructor(
    @Inject(BREEDING_SERVICE_REPOSITORY)
    private readonly services: IBreedingServiceRepository,
    @Inject(BIRTH_REPOSITORY) private readonly births: IBirthRepository,
    @Inject(REPRODUCTION_QUERY_REPOSITORY)
    private readonly queries: IReproductionQueryRepository,
    private readonly getAnimal: GetAnimalUseCase,
  ) {}

  async animalHistory(animalId: string): Promise<AnimalReproduction> {
    const animal = await this.getAnimal.execute(animalId);
    const page = { page: 1, limit: HISTORY_LIMIT };
    const [services, births] = await Promise.all([
      this.services.findPaginated({ animalId }, page),
      this.births.findPaginated({ animalId }, page),
    ]);
    const role = animal.getSex() === Sex.FEMALE ? 'dam' : 'sire';
    const asParent = births.items.filter(
      (b) => (role === 'dam' ? b.getDam().id : b.getSire()?.id) === animalId,
    );
    const offspring = asParent.reduce((n, b) => n + b.getLitterSize(), 0);
    return {
      services: services.items,
      births: births.items,
      summary: {
        births: asParent.length,
        offspring,
        bornAlive: asParent.reduce((n, b) => n + b.getBornAlive(), 0),
        multipleBirths: asParent.filter((b) => b.getLitterSize() > 1).length,
        averageLitterSize: asParent.length
          ? Math.round((offspring / asParent.length) * 100) / 100
          : null,
        lastBirthDate: asParent[0]?.getBirthDate() ?? null,
        openService:
          role === 'dam'
            ? (services.items.find((s) =>
                OPEN_SERVICE_STATUSES.includes(s.getStatus()),
              ) ?? null)
            : null,
      },
    };
  }

  async stats(filters: StatsFilters) {
    const stats: ReproductionStats = await this.queries.stats(filters);
    const { services, births } = stats;
    const multiple =
      births.byLitterSize['2'] +
      births.byLitterSize['3'] +
      births.byLitterSize['4'];
    return {
      filters,
      ...stats,
      indicators: {
        /** Preñadas (o paridas/abortadas) sobre montas con resultado, en %. */
        fertilityRate: rate(services.conceptions, services.withResult),
        /** Crías por parto. */
        prolificacy: births.total
          ? Math.round((births.offspring / births.total) * 100) / 100
          : null,
        /** Partos dobles, triples o más, sobre el total de partos, en %. */
        multipleBirthRate: rate(multiple, births.total),
        /** Crías nacidas muertas sobre el total de crías, en %. */
        stillbirthRate: rate(births.bornDead, births.offspring),
        averageBirthIntervalDays: births.averageIntervalDays,
      },
    };
  }

  async reminders(until?: string): Promise<{
    pregnancyChecks: (PendingPregnancyCheck & { overdue: boolean })[];
    upcomingBirths: (UpcomingBirth & { overdue: boolean })[];
  }> {
    const today = toDateOnly(new Date());
    const [checks, births] = await Promise.all([
      this.queries.pendingPregnancyChecks(
        until ?? addDays(today, UPCOMING_CHECK_DAYS),
      ),
      this.queries.upcomingBirths(until ?? addDays(today, UPCOMING_BIRTH_DAYS)),
    ]);
    return {
      // "Atrasado": pasó la ventana de diagnóstico (monta + 45 días).
      pregnancyChecks: checks.map((c) => ({
        ...c,
        overdue: addDays(c.serviceDate, PREGNANCY_CHECK_DAYS.to) < today,
      })),
      upcomingBirths: births.map((b) => ({
        ...b,
        overdue: b.expectedBirthDate < today,
      })),
    };
  }
}
