import { Paginated, PaginationParams } from '@shared/domain/paginated';
import {
  ControlType,
  NotificationTarget,
  NotificationType,
} from './notification.enums';
import type { ControlState, NotificationSettings } from './notification-rules';

export interface StoredSettings extends NotificationSettings {
  lastRunOn: string | null;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  targetType: NotificationTarget | null;
  targetId: string | null;
  /** Filtro de la pantalla destino (p. ej. el tipo de control). */
  targetFilter: string | null;
  /** Evita repetir el mismo aviso al mismo usuario. */
  dedupKey: string;
}

export interface NotificationRow extends NewNotification {
  id: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface PushSubscriptionRow {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface INotificationsRepository {
  getSettings(): Promise<StoredSettings>;
  saveSettings(settings: NotificationSettings, actorId: string): Promise<void>;
  setLastRun(date: string): Promise<void>;
  /** Guarda las claves solo si todavía no hay (la primera vez). */
  initVapidKeys(publicKey: string, privateKey: string): Promise<void>;

  /** Inserta las que no existan (por usuario y dedupKey) y devuelve esas. */
  insertMany(rows: NewNotification[]): Promise<NotificationRow[]>;
  listForUser(
    userId: string,
    unreadOnly: boolean,
    pagination: PaginationParams,
  ): Promise<Paginated<NotificationRow>>;
  countUnread(userId: string): Promise<number>;
  markRead(userId: string, id: string): Promise<boolean>;
  markAllRead(userId: string): Promise<number>;
  /** Borra las leídas más viejas que `readDays` y todas las más viejas que `anyDays`. */
  purge(readDays: number, anyDays: number): Promise<number>;

  saveSubscription(
    userId: string,
    sub: { endpoint: string; p256dh: string; auth: string },
    userAgent: string | null,
  ): Promise<void>;
  deleteSubscription(userId: string, endpoint: string): Promise<boolean>;
  subscriptionsFor(userIds: string[]): Promise<PushSubscriptionRow[]>;
  recordPushResult(id: string, result: 'ok' | 'gone' | 'failed'): Promise<void>;
}

export const NOTIFICATIONS_REPOSITORY = Symbol('INotificationsRepository');

/** Un control de un animal, con su vencimiento vigente. */
export interface ControlItem {
  animalId: string;
  earTag: string | null;
  name: string | null;
  species: string;
  sex: string;
  birthDate: string | null;
  /** Último pesaje o registro sanitario (null en el destete). */
  lastDate: string | null;
  /** Vencimiento calculado (sin justificación). */
  baseDueDate: string;
  /** Vencimiento vigente: el reprogramado si hay justificación. */
  dueDate: string;
  state: ControlState;
  daysOverdue: number;
  justification: {
    reason: string;
    nextDueDate: string | null;
    createdAt: Date;
    createdBy: string | null;
  } | null;
}

export interface ControlQuery {
  type: ControlType;
  settings: NotificationSettings;
  today: string;
  /** PENDING = atrasados + hoy + próximos. */
  state?: ControlState | 'PENDING';
  animalIds?: string[];
  search?: string;
}

export interface ControlCounts {
  overdue: number;
  today: number;
  upcoming: number;
  /** Entran hoy en el período de "próximos". */
  enteringUpcoming: number;
  /** Se atrasaron hoy (vencían ayer). */
  newlyOverdue: number;
}

export interface UpcomingBirthRow {
  serviceId: string;
  expectedBirthDate: string;
  status: string;
  damEarTag: string | null;
  damName: string | null;
  sireEarTag: string | null;
  sireName: string | null;
  fetusCount: number | null;
}

export interface JustificationRow {
  id: string;
  animalId: string;
  type: ControlType;
  resolvedDueDate: string;
  nextDueDate: string | null;
  reason: string;
  createdAt: Date;
  createdBy: string | null;
  createdByName: string | null;
}

export interface IControlsRepository {
  find(
    query: ControlQuery,
    pagination?: PaginationParams,
  ): Promise<Paginated<ControlItem>>;
  counts(
    type: ControlType,
    settings: NotificationSettings,
    today: string,
  ): Promise<ControlCounts>;
  insertJustifications(
    rows: {
      animalId: string;
      type: ControlType;
      resolvedDueDate: string;
      nextDueDate: string | null;
      reason: string;
      createdBy: string;
    }[],
  ): Promise<void>;
  justifications(filters: {
    animalId?: string;
    type?: ControlType;
  }): Promise<JustificationRow[]>;
  upcomingBirths(from: string, to: string): Promise<UpcomingBirthRow[]>;
}

export const CONTROLS_REPOSITORY = Symbol('IControlsRepository');
