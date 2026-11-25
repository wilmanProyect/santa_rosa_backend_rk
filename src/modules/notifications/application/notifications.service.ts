import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Paginated } from '@shared/domain/paginated';
import {
  assertSettings,
  NotificationSettings,
} from '../domain/notification-rules';
import {
  NOTIFICATIONS_REPOSITORY,
  NotificationRow,
  StoredSettings,
} from '../domain/notifications.repository.interface';
import type { INotificationsRepository } from '../domain/notifications.repository.interface';
import { NotificationType } from '../domain/notification.enums';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { DailyAlertsService, DailyRunResult } from './daily-alerts.service';
import { FARM_TIME_ZONE, farmNow } from './farm-clock';
import {
  ListNotificationsQueryDto,
  PushSubscriptionDto,
  UpdateNotificationSettingsDto,
} from './notifications.dto';

/**
 * Servicios de push de los navegadores. El servidor solo envía a estos hosts:
 * así un usuario no puede hacer que la API llame a direcciones internas.
 */
const PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge (Android), Opera
  'updates.push.services.mozilla.com', // Firefox
  '.push.apple.com', // Safari
  '.notify.windows.com', // Edge (Windows)
];

export function assertPushEndpoint(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new BadRequestException(
      'La dirección de la suscripción no es válida',
    );
  }
  const host = url.hostname.toLowerCase();
  const allowed = PUSH_HOSTS.some((h) =>
    h.startsWith('.') ? host.endsWith(h) : host === h,
  );
  if (url.protocol !== 'https:' || !allowed) {
    throw new BadRequestException(
      'La suscripción no es de un servicio de notificaciones conocido (Chrome, Edge, Firefox o Safari)',
    );
  }
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
    private readonly dispatcher: NotificationDispatcher,
    private readonly daily: DailyAlertsService,
    @Inject(FARM_TIME_ZONE) private readonly timeZone: string,
  ) {}

  // ---------- Notificaciones del usuario ----------

  list(
    userId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<NotificationRow>> {
    return this.repository.listForUser(userId, query.unreadOnly ?? false, {
      page: query.page,
      limit: query.limit,
    });
  }

  unreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markRead(userId: string, id: string): Promise<void> {
    if (!(await this.repository.markRead(userId, id))) {
      throw new NotFoundException('No se encontró la notificación');
    }
  }

  markAllRead(userId: string): Promise<number> {
    return this.repository.markAllRead(userId);
  }

  // ---------- Push ----------

  async publicKey(): Promise<string> {
    return (await this.dispatcher.vapidKeys()).publicKey;
  }

  async subscribe(
    userId: string,
    dto: PushSubscriptionDto,
    userAgent: string | null,
  ): Promise<void> {
    assertPushEndpoint(dto.endpoint);
    await this.repository.saveSubscription(
      userId,
      { endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
      userAgent,
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.repository.deleteSubscription(userId, endpoint);
  }

  /** Envía un push de prueba a los navegadores del usuario (no queda en la campana). */
  async sendTest(userId: string): Promise<{ sent: number; failed: number }> {
    const result = await this.dispatcher.push([
      {
        id: '00000000-0000-0000-0000-000000000000',
        userId,
        type: NotificationType.BIRTH_UPCOMING,
        title: 'Notificaciones activadas',
        body: 'Así se verán los avisos de Santa Rosa en este dispositivo.',
        targetType: null,
        targetId: null,
        targetFilter: null,
        dedupKey: 'test',
        createdAt: new Date(),
        readAt: null,
      },
    ]);
    if (result.sent === 0 && result.failed === 0) {
      throw new BadRequestException(
        'Este usuario no tiene navegadores suscritos a las notificaciones',
      );
    }
    return result;
  }

  // ---------- Configuración ----------

  async settings(): Promise<
    Omit<StoredSettings, 'vapidPrivateKey' | 'vapidPublicKey'>
  > {
    // Las claves VAPID no salen de la API (la pública tiene su endpoint).
    const s = await this.repository.getSettings();
    return {
      weighingIntervalMonths: s.weighingIntervalMonths,
      healthIntervalMonths: s.healthIntervalMonths,
      weaningAgeMonths: s.weaningAgeMonths,
      weaningTrackingFrom: s.weaningTrackingFrom,
      upcomingDays: s.upcomingDays,
      runHour: s.runHour,
      lastRunOn: s.lastRunOn,
      updatedAt: s.updatedAt,
      updatedBy: s.updatedBy,
    };
  }

  async updateSettings(
    actorId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<Omit<StoredSettings, 'vapidPrivateKey' | 'vapidPublicKey'>> {
    const current = await this.repository.getSettings();
    const next: NotificationSettings = {
      weighingIntervalMonths:
        dto.weighingIntervalMonths ?? current.weighingIntervalMonths,
      healthIntervalMonths:
        dto.healthIntervalMonths ?? current.healthIntervalMonths,
      weaningAgeMonths: dto.weaningAgeMonths ?? current.weaningAgeMonths,
      weaningTrackingFrom:
        dto.weaningTrackingFrom ?? current.weaningTrackingFrom,
      upcomingDays: dto.upcomingDays ?? current.upcomingDays,
      runHour: dto.runHour ?? current.runHour,
    };
    assertSettings(next, farmNow(this.timeZone).date);
    await this.repository.saveSettings(next, actorId);
    return this.settings();
  }

  /** Ejecuta la revisión diaria ahora (no repite avisos ya enviados hoy). */
  async runNow(): Promise<DailyRunResult> {
    const now = farmNow(this.timeZone);
    const result = await this.daily.run(now.date, now.weekday);
    await this.repository.setLastRun(now.date);
    return result;
  }
}
