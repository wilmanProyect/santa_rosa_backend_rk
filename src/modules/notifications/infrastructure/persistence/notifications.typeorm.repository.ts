import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { Paginated, PaginationParams } from '@shared/domain/paginated';
import { returningRows } from '@shared/infrastructure/persistence/returning-rows';
import type { NotificationSettings } from '../../domain/notification-rules';
import {
  INotificationsRepository,
  NewNotification,
  NotificationRow,
  PushSubscriptionRow,
  StoredSettings,
} from '../../domain/notifications.repository.interface';
import {
  NotificationTarget,
  NotificationType,
} from '../../domain/notification.enums';

interface SettingsDbRow {
  weighing_interval_months: number;
  health_interval_months: number;
  weaning_age_months: number;
  weaning_tracking_from: string;
  upcoming_days: number;
  run_hour: number;
  last_run_on: string | null;
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  updated_at: Date;
  updated_by: string | null;
}

interface NotificationDbRow {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  target_type: NotificationTarget | null;
  target_id: string | null;
  target_filter: string | null;
  dedup_key: string;
  created_at: Date;
  read_at: Date | null;
}

const toNotification = (r: NotificationDbRow): NotificationRow => ({
  id: r.id,
  userId: r.user_id,
  type: r.type,
  title: r.title,
  body: r.body,
  targetType: r.target_type,
  targetId: r.target_id,
  targetFilter: r.target_filter,
  dedupKey: r.dedup_key,
  createdAt: r.created_at,
  readAt: r.read_at,
});

/** Tras tantos fallos seguidos (no 404/410), la suscripción se descarta. */
const MAX_PUSH_FAILURES = 20;

@Injectable()
export class NotificationsTypeormRepository implements INotificationsRepository {
  constructor(private readonly db: DataSource) {}

  async getSettings(): Promise<StoredSettings> {
    const [r] = await this.db.query<SettingsDbRow[]>(
      `SELECT weighing_interval_months, health_interval_months, weaning_age_months,
              to_char(weaning_tracking_from, 'YYYY-MM-DD') AS weaning_tracking_from,
              upcoming_days, run_hour, to_char(last_run_on, 'YYYY-MM-DD') AS last_run_on,
              vapid_public_key, vapid_private_key, updated_at, updated_by
         FROM notification_settings WHERE id = 1`,
    );
    if (!r) throw new Error('Falta la fila de notification_settings');
    return {
      weighingIntervalMonths: r.weighing_interval_months,
      healthIntervalMonths: r.health_interval_months,
      weaningAgeMonths: r.weaning_age_months,
      weaningTrackingFrom: r.weaning_tracking_from,
      upcomingDays: r.upcoming_days,
      runHour: r.run_hour,
      lastRunOn: r.last_run_on,
      vapidPublicKey: r.vapid_public_key,
      vapidPrivateKey: r.vapid_private_key,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    };
  }

  async saveSettings(s: NotificationSettings, actorId: string): Promise<void> {
    await this.db.query(
      `UPDATE notification_settings
          SET weighing_interval_months = $1, health_interval_months = $2,
              weaning_age_months = $3, weaning_tracking_from = $4,
              upcoming_days = $5, run_hour = $6,
              updated_at = now(), updated_by = $7
        WHERE id = 1`,
      [
        s.weighingIntervalMonths,
        s.healthIntervalMonths,
        s.weaningAgeMonths,
        s.weaningTrackingFrom,
        s.upcomingDays,
        s.runHour,
        actorId,
      ],
    );
  }

  async setLastRun(date: string): Promise<void> {
    await this.db.query(
      `UPDATE notification_settings SET last_run_on = $1 WHERE id = 1`,
      [date],
    );
  }

  async initVapidKeys(publicKey: string, privateKey: string): Promise<void> {
    await this.db.query(
      `UPDATE notification_settings
          SET vapid_public_key = $1, vapid_private_key = $2
        WHERE id = 1 AND vapid_public_key IS NULL`,
      [publicKey, privateKey],
    );
  }

  async insertMany(rows: NewNotification[]): Promise<NotificationRow[]> {
    if (rows.length === 0) return [];
    const inserted: NotificationRow[] = [];
    // Por lotes, para no pasar el límite de parámetros de PostgreSQL.
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const params: unknown[] = [];
      const values = batch.map((n) => {
        params.push(
          randomUUID(),
          n.userId,
          n.type,
          n.title.slice(0, 150),
          n.body.slice(0, 500),
          n.targetType,
          n.targetId,
          n.targetFilter,
          n.dedupKey,
        );
        const b = params.length - 9;
        return `(${Array.from({ length: 9 }, (_, k) => `$${b + k + 1}`).join(', ')})`;
      });
      const result = returningRows<NotificationDbRow>(
        await this.db.query(
          `INSERT INTO notifications
           (id, user_id, type, title, body, target_type, target_id, target_filter, dedup_key)
         VALUES ${values.join(', ')}
         ON CONFLICT (user_id, dedup_key) DO NOTHING
         RETURNING *`,
          params,
        ),
      );
      inserted.push(...result.map(toNotification));
    }
    return inserted;
  }

  async listForUser(
    userId: string,
    unreadOnly: boolean,
    { page, limit }: PaginationParams,
  ): Promise<Paginated<NotificationRow>> {
    const where = `user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''}`;
    const [{ total }] = await this.db.query<{ total: string }[]>(
      `SELECT COUNT(*) AS total FROM notifications WHERE ${where}`,
      [userId],
    );
    const rows = await this.db.query<NotificationDbRow[]>(
      `SELECT * FROM notifications WHERE ${where}
        ORDER BY created_at DESC, id LIMIT $2 OFFSET $3`,
      [userId, limit, (page - 1) * limit],
    );
    return {
      items: rows.map(toNotification),
      total: Number(total),
      page,
      limit,
    };
  }

  async countUnread(userId: string): Promise<number> {
    const [{ n }] = await this.db.query<{ n: string }[]>(
      `SELECT COUNT(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
    return Number(n);
  }

  async markRead(userId: string, id: string): Promise<boolean> {
    const rows = returningRows<{ id: string }>(
      await this.db.query(
        `UPDATE notifications SET read_at = COALESCE(read_at, now())
        WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId],
      ),
    );
    return rows.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const rows = returningRows<{ id: string }>(
      await this.db.query(
        `UPDATE notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL RETURNING id`,
        [userId],
      ),
    );
    return rows.length;
  }

  async purge(readDays: number, anyDays: number): Promise<number> {
    const rows = returningRows<{ id: string }>(
      await this.db.query(
        `DELETE FROM notifications
        WHERE (read_at IS NOT NULL AND created_at < now() - make_interval(days => $1))
           OR created_at < now() - make_interval(days => $2)
        RETURNING id`,
        [readDays, anyDays],
      ),
    );
    return rows.length;
  }

  async saveSubscription(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string },
    userAgent: string | null,
  ): Promise<void> {
    // El mismo navegador puede cambiar de usuario: el endpoint pasa al último.
    await this.db.query(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent,
             failure_count = 0`,
      [
        randomUUID(),
        userId,
        sub.endpoint,
        sub.p256dh,
        sub.auth,
        userAgent?.slice(0, 300) ?? null,
      ],
    );
  }

  async deleteSubscription(userId: string, endpoint: string): Promise<boolean> {
    const rows = returningRows<{ id: string }>(
      await this.db.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2 RETURNING id`,
        [userId, endpoint],
      ),
    );
    return rows.length > 0;
  }

  async subscriptionsFor(userIds: string[]): Promise<PushSubscriptionRow[]> {
    if (userIds.length === 0) return [];
    const rows = await this.db.query<
      {
        id: string;
        user_id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
      }[]
    >(
      `SELECT id, user_id, endpoint, p256dh, auth FROM push_subscriptions
        WHERE user_id = ANY($1::uuid[])`,
      [userIds],
    );
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
    }));
  }

  async recordPushResult(
    id: string,
    result: 'ok' | 'gone' | 'failed',
  ): Promise<void> {
    if (result === 'gone') {
      await this.db.query(`DELETE FROM push_subscriptions WHERE id = $1`, [id]);
    } else if (result === 'ok') {
      await this.db.query(
        `UPDATE push_subscriptions SET last_success_at = now(), failure_count = 0 WHERE id = $1`,
        [id],
      );
    } else {
      await this.db.query(
        `UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`,
        [id],
      );
      await this.db.query(
        `DELETE FROM push_subscriptions WHERE id = $1 AND failure_count >= $2`,
        [id, MAX_PUSH_FAILURES],
      );
    }
  }
}
