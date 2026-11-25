import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  addDays,
  daysBetween,
} from '@modules/animals/domain/models/animal-event-date';
import {
  BIRTH_ALERT_DAYS,
  CONTROL_LABEL,
  CONTROL_NOTIFICATION,
  ControlType,
  NotificationTarget,
  NotificationType,
} from '../domain/notification.enums';
import { birthAlertStage, birthAlertTitle } from '../domain/notification-rules';
import {
  CONTROLS_REPOSITORY,
  ControlCounts,
  NOTIFICATIONS_REPOSITORY,
  UpcomingBirthRow,
} from '../domain/notifications.repository.interface';
import type {
  IControlsRepository,
  INotificationsRepository,
} from '../domain/notifications.repository.interface';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { formatDate } from './farm-clock';

/** Las leídas se borran a los 90 días; todas, a los 180. */
const PURGE_READ_DAYS = 90;
const PURGE_ANY_DAYS = 180;
/** Día del recordatorio semanal de lo atrasado (1 = lunes). */
const WEEKLY_DIGEST_WEEKDAY = 1;

export interface DailyRunResult {
  date: string;
  births: number;
  controls: Record<ControlType, ControlCounts & { notified: boolean }>;
  created: number;
  purged: number;
}

const describe = (earTag: string | null, name: string | null) =>
  [earTag, name].filter(Boolean).join(' — ') || 'sin identificar';

/**
 * Revisión diaria (la lanza NotificationScheduler a la hora configurada).
 * Es idempotente: correrla dos veces el mismo día no repite avisos.
 */
@Injectable()
export class DailyAlertsService {
  private readonly logger = new Logger(DailyAlertsService.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
    @Inject(CONTROLS_REPOSITORY)
    private readonly controls: IControlsRepository,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  async run(today: string, weekday: number): Promise<DailyRunResult> {
    const settings = await this.repository.getSettings();
    let created = 0;

    // 1. Partos: un aviso por monta en cada etapa (10, 5, 2, 1 y 0 días).
    const births = await this.controls.upcomingBirths(
      today,
      addDays(today, Math.max(...BIRTH_ALERT_DAYS)),
    );
    const birthItems = births.flatMap((b) => {
      const daysLeft = daysBetween(today, b.expectedBirthDate);
      const stage = birthAlertStage(daysLeft);
      if (stage === null) return [];
      return [
        {
          title: birthAlertTitle(daysLeft),
          body: birthBody(b),
          targetType: NotificationTarget.BREEDING_SERVICE,
          targetId: b.serviceId,
          targetFilter: null,
          // Incluye la fecha probable: si se corrige la monta, se vuelve a avisar.
          dedupKey: `birth:${b.serviceId}:${b.expectedBirthDate}:${stage}`,
        },
      ];
    });
    created += (
      await this.dispatcher.publish(NotificationType.BIRTH_UPCOMING, birthItems)
    ).length;

    // 2. Controles: un resumen por tipo cuando hay novedades ese día (algo
    //    entra en "próximos", vence hoy o se atrasó), y los lunes si hay
    //    atrasados aunque no haya novedades.
    const controls = {} as DailyRunResult['controls'];
    for (const type of Object.values(ControlType)) {
      const counts = await this.controls.counts(type, settings, today);
      const news =
        counts.enteringUpcoming > 0 ||
        counts.today > 0 ||
        counts.newlyOverdue > 0;
      const weekly = weekday === WEEKLY_DIGEST_WEEKDAY && counts.overdue > 0;
      let notified = false;
      if (news || weekly) {
        const inserted = await this.dispatcher.publish(
          CONTROL_NOTIFICATION[type],
          [
            {
              title: controlTitle(type, counts),
              body: controlBody(counts, settings.upcomingDays),
              targetType: NotificationTarget.CONTROLS,
              targetId: null,
              targetFilter: type,
              dedupKey: `${type.toLowerCase()}:${today}`,
            },
          ],
        );
        created += inserted.length;
        notified = inserted.length > 0;
      }
      controls[type] = { ...counts, notified };
    }

    const purged = await this.repository.purge(PURGE_READ_DAYS, PURGE_ANY_DAYS);
    this.logger.log(
      `Revisión del ${today}: ${birthItems.length} avisos de parto, ${created} notificaciones nuevas, ${purged} viejas borradas`,
    );
    return {
      date: today,
      births: birthItems.length,
      controls,
      created,
      purged,
    };
  }
}

function birthBody(b: UpcomingBirthRow): string {
  const diagnosis =
    b.status === 'PREGNANT'
      ? b.fetusCount
        ? `Preñada (${b.fetusCount} ${b.fetusCount === 1 ? 'feto' : 'fetos'})`
        : 'Preñada'
      : 'Sin diagnóstico de preñez';
  return `${describe(b.damEarTag, b.damName)} · ${diagnosis} · Macho: ${describe(b.sireEarTag, b.sireName)} · Fecha probable: ${formatDate(b.expectedBirthDate)}`;
}

function controlTitle(type: ControlType, c: ControlCounts): string {
  const parts: string[] = [];
  if (c.today) parts.push(`${c.today} para hoy`);
  if (c.overdue)
    parts.push(`${c.overdue} ${c.overdue === 1 ? 'atrasado' : 'atrasados'}`);
  if (!parts.length)
    parts.push(`${c.upcoming} ${c.upcoming === 1 ? 'próximo' : 'próximos'}`);
  return `${CONTROL_LABEL[type]}: ${parts.join(', ')}`;
}

function controlBody(c: ControlCounts, upcomingDays: number): string {
  return [
    `Atrasados: ${c.overdue}`,
    `Hoy: ${c.today}`,
    `Próximos ${upcomingDays} días: ${c.upcoming}`,
    c.overdue ? 'Registre el control o justifique por qué no se hizo.' : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
