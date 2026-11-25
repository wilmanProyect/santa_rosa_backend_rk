import { Inject, Injectable, Logger } from '@nestjs/common';
import { USER_REPOSITORY } from '@modules/users/domain/repositories/user.repository.interface';
import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { UserStatus } from '@modules/users/domain/enums/user-status.enum';
import {
  NOTIFICATION_PERMISSION,
  NotificationType,
} from '../domain/notification.enums';
import {
  NOTIFICATIONS_REPOSITORY,
  NewNotification,
  NotificationRow,
} from '../domain/notifications.repository.interface';
import type { INotificationsRepository } from '../domain/notifications.repository.interface';
import type {
  PushSubscriptionKeys,
  VapidKeys,
} from '../infrastructure/push/web-push';

/** Envía un mensaje push; devuelve el código HTTP del servicio de push. */
export type WebPushSender = (
  subscription: PushSubscriptionKeys,
  payload: object,
  vapid: { keys: VapidKeys; subject: string },
) => Promise<number>;

export const WEB_PUSH_SENDER = Symbol('WEB_PUSH_SENDER');
export const VAPID_SUBJECT = Symbol('VAPID_SUBJECT');
export const VAPID_KEY_GENERATOR = Symbol('VAPID_KEY_GENERATOR');

export type NotificationContent = Omit<NewNotification, 'userId' | 'type'>;

/**
 * Crea los avisos para los usuarios que corresponden y los envía por push a
 * sus navegadores. Un mismo aviso (dedupKey) nunca se repite a un usuario.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(WEB_PUSH_SENDER) private readonly sender: WebPushSender,
    @Inject(VAPID_SUBJECT) private readonly subject: string,
    @Inject(VAPID_KEY_GENERATOR)
    private readonly generateKeys: () => VapidKeys,
  ) {}

  /** Usuarios activos con el permiso del tipo de aviso. */
  async recipients(type: NotificationType): Promise<string[]> {
    const permission = NOTIFICATION_PERMISSION[type];
    const ids: string[] = [];
    for (let page = 1; ; page++) {
      const result = await this.users.findPaginated(
        { status: UserStatus.ACTIVE },
        { page, limit: 100 },
      );
      for (const user of result.items) {
        if (user.getEffectivePermissionCodes().includes(permission)) {
          ids.push(user.getId());
        }
      }
      if (page * result.limit >= result.total) break;
    }
    return ids;
  }

  /** Publica los avisos a todos los destinatarios del tipo. Devuelve los nuevos. */
  async publish(
    type: NotificationType,
    items: NotificationContent[],
  ): Promise<NotificationRow[]> {
    if (items.length === 0) return [];
    const userIds = await this.recipients(type);
    const inserted = await this.repository.insertMany(
      userIds.flatMap((userId) =>
        items.map((item) => ({ ...item, userId, type })),
      ),
    );
    await this.push(inserted);
    return inserted;
  }

  /** Claves VAPID: se generan la primera vez y quedan en la base. */
  async vapidKeys(): Promise<VapidKeys> {
    let settings = await this.repository.getSettings();
    if (!settings.vapidPublicKey || !settings.vapidPrivateKey) {
      const keys = this.generateKeys();
      await this.repository.initVapidKeys(keys.publicKey, keys.privateKey);
      settings = await this.repository.getSettings();
    }
    return {
      publicKey: settings.vapidPublicKey!,
      privateKey: settings.vapidPrivateKey!,
    };
  }

  /** Envía por push cada aviso a los navegadores de su usuario. */
  async push(notifications: NotificationRow[]): Promise<{
    sent: number;
    failed: number;
  }> {
    const result = { sent: 0, failed: 0 };
    if (notifications.length === 0) return result;
    const subscriptions = await this.repository.subscriptionsFor([
      ...new Set(notifications.map((n) => n.userId)),
    ]);
    if (subscriptions.length === 0) return result;
    const vapid = { keys: await this.vapidKeys(), subject: this.subject };

    for (const n of notifications) {
      const payload = {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        target: n.targetType
          ? { type: n.targetType, id: n.targetId, filter: n.targetFilter }
          : null,
      };
      for (const sub of subscriptions.filter((s) => s.userId === n.userId)) {
        let status: number;
        try {
          status = await this.sender(sub, payload, vapid);
        } catch (error) {
          this.logger.warn(
            `Push no enviado a ${new URL(sub.endpoint).host}: ${(error as Error).message}`,
          );
          status = 0;
        }
        if (status >= 200 && status < 300) {
          result.sent++;
          await this.repository.recordPushResult(sub.id, 'ok');
        } else if (status === 404 || status === 410) {
          // El navegador anuló la suscripción: se borra.
          await this.repository.recordPushResult(sub.id, 'gone');
        } else {
          result.failed++;
          if (status) {
            this.logger.warn(
              `Push rechazado por ${new URL(sub.endpoint).host}: HTTP ${status}`,
            );
          }
          await this.repository.recordPushResult(sub.id, 'failed');
        }
      }
    }
    return result;
  }
}
