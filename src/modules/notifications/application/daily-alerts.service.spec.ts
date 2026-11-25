import type { IUserRepository } from '@modules/users/domain/repositories/user.repository.interface';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import {
  ControlType,
  NotificationTarget,
  NotificationType,
} from '../domain/notification.enums';
import type {
  ControlCounts,
  IControlsRepository,
  INotificationsRepository,
  NewNotification,
  NotificationRow,
  PushSubscriptionRow,
  StoredSettings,
  UpcomingBirthRow,
} from '../domain/notifications.repository.interface';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { DailyAlertsService } from './daily-alerts.service';
import { NotificationScheduler } from '../infrastructure/notification-scheduler';

const settings: StoredSettings = {
  weighingIntervalMonths: 3,
  healthIntervalMonths: 3,
  weaningAgeMonths: 3,
  weaningTrackingFrom: '2026-05-24',
  upcomingDays: 7,
  runHour: 6,
  lastRunOn: null,
  vapidPublicKey: null,
  vapidPrivateKey: null,
  updatedAt: new Date(),
  updatedBy: null,
};

class FakeNotifications implements Partial<INotificationsRepository> {
  rows: NotificationRow[] = [];
  subs: PushSubscriptionRow[] = [];
  results: [string, string][] = [];
  settings = { ...settings };
  getSettings = () => Promise.resolve({ ...this.settings });
  setLastRun = (date: string) => {
    this.settings.lastRunOn = date;
    return Promise.resolve();
  };
  initVapidKeys = (publicKey: string, privateKey: string) => {
    this.settings.vapidPublicKey ??= publicKey;
    this.settings.vapidPrivateKey ??= privateKey;
    return Promise.resolve();
  };
  insertMany = (rows: NewNotification[]) => {
    const fresh = rows
      .filter(
        (r) =>
          !this.rows.some(
            (x) => x.userId === r.userId && x.dedupKey === r.dedupKey,
          ),
      )
      .map((r, i) => ({
        ...r,
        id: `n${this.rows.length + i}`,
        createdAt: new Date(),
        readAt: null,
      }));
    this.rows.push(...fresh);
    return Promise.resolve(fresh);
  };
  subscriptionsFor = (ids: string[]) =>
    Promise.resolve(this.subs.filter((s) => ids.includes(s.userId)));
  recordPushResult = (id: string, r: 'ok' | 'gone' | 'failed') => {
    this.results.push([id, r]);
    return Promise.resolve();
  };
  purge = () => Promise.resolve(0);
}

const zero: ControlCounts = {
  overdue: 0,
  today: 0,
  upcoming: 0,
  enteringUpcoming: 0,
  newlyOverdue: 0,
};

class FakeControls implements Partial<IControlsRepository> {
  births: UpcomingBirthRow[] = [];
  byType: Partial<Record<ControlType, ControlCounts>> = {};
  upcomingBirths = () => Promise.resolve(this.births);
  counts = (type: ControlType) => Promise.resolve(this.byType[type] ?? zero);
}

const user = (id: string, perms: string[]) => ({
  getId: () => id,
  getEffectivePermissionCodes: () => perms,
});

function setup() {
  const repo = new FakeNotifications();
  const controls = new FakeControls();
  const users = {
    findPaginated: () =>
      Promise.resolve({
        items: [
          user('admin', Object.values(PERMISSIONS)),
          user('vet', [PERMISSIONS.HEALTH_WRITE]),
          user('peon', [PERMISSIONS.WEIGHINGS_WRITE]),
        ],
        total: 3,
        page: 1,
        limit: 100,
      }),
  } as unknown as IUserRepository;
  const sent: { endpoint: string; payload: Record<string, unknown> }[] = [];
  const statusFor: Record<string, number> = {};
  const dispatcher = new NotificationDispatcher(
    repo as unknown as INotificationsRepository,
    users,
    (sub, payload) => {
      sent.push({
        endpoint: sub.endpoint,
        payload: payload as Record<string, unknown>,
      });
      return Promise.resolve(statusFor[sub.endpoint] ?? 201);
    },
    'https://santarosa.test',
    () => ({ publicKey: 'PUB', privateKey: 'PRIV' }),
  );
  const daily = new DailyAlertsService(
    repo as unknown as INotificationsRepository,
    controls as unknown as IControlsRepository,
    dispatcher,
  );
  return { repo, controls, dispatcher, daily, sent, statusFor };
}

const birth = (id: string, expected: string): UpcomingBirthRow => ({
  serviceId: id,
  expectedBirthDate: expected,
  status: 'PREGNANT',
  damEarTag: '0',
  damName: 'NALA',
  sireEarTag: '135',
  sireName: 'TORO',
  fetusCount: 2,
});

describe('Revisión diaria', () => {
  it('avisa del parto a quien tiene reproduction:read, una vez por etapa', async () => {
    const { repo, controls, daily } = setup();
    controls.births = [birth('s1', '2026-11-29'), birth('s2', '2026-12-10')];
    await daily.run('2026-11-24', 2);
    const births = repo.rows.filter(
      (r) => r.type === NotificationType.BIRTH_UPCOMING,
    );
    expect(births.map((r) => [r.userId, r.title])).toEqual([
      ['admin', 'Parto probable en 5 días'],
    ]);
    expect(births[0]).toMatchObject({
      targetType: NotificationTarget.BREEDING_SERVICE,
      targetId: 's1',
      dedupKey: 'birth:s1:2026-11-29:5',
    });
    expect(births[0].body).toContain('0 — NALA · Preñada (2 fetos)');
    expect(births[0].body).toContain('29/11/2026');

    // Correrla de nuevo el mismo día (o al siguiente, aún en la etapa 5) no repite.
    await daily.run('2026-11-24', 2);
    await daily.run('2026-11-25', 3);
    expect(
      repo.rows.filter((r) => r.type === NotificationType.BIRTH_UPCOMING),
    ).toHaveLength(1);
    // A 2 días, la siguiente etapa.
    await daily.run('2026-11-27', 5);
    expect(
      repo.rows
        .filter((r) => r.type === NotificationType.BIRTH_UPCOMING)
        .map((r) => r.title),
    ).toEqual(['Parto probable en 5 días', 'Parto probable en 2 días']);
  });

  it('resume los controles con novedades, para los usuarios con el permiso del control', async () => {
    const { repo, controls, daily } = setup();
    controls.byType = {
      [ControlType.HEALTH]: {
        ...zero,
        overdue: 4,
        newlyOverdue: 1,
        upcoming: 2,
      },
      [ControlType.WEANING]: {
        ...zero,
        today: 2,
        upcoming: 3,
        enteringUpcoming: 1,
      },
      // Atrasados sin novedades: no avisa (no es lunes).
      [ControlType.WEIGHING]: { ...zero, overdue: 120 },
    };
    const result = await daily.run('2026-11-24', 2);
    const health = repo.rows.filter(
      (r) => r.type === NotificationType.HEALTH_DUE,
    );
    expect(health.map((r) => r.userId).sort()).toEqual(['admin', 'vet']);
    expect(health[0]).toMatchObject({
      title: 'Control sanitario: 4 atrasados',
      targetType: NotificationTarget.CONTROLS,
      targetFilter: ControlType.HEALTH,
      dedupKey: 'health:2026-11-24',
    });
    expect(health[0].body).toContain('justifique');
    const weaning = repo.rows.filter(
      (r) => r.type === NotificationType.WEANING_DUE,
    );
    expect(weaning.map((r) => r.userId).sort()).toEqual(['admin', 'peon']);
    expect(weaning[0].title).toBe('Destete: 2 para hoy');
    expect(
      repo.rows.some((r) => r.type === NotificationType.WEIGHING_DUE),
    ).toBe(false);
    expect(result.controls.WEIGHING.notified).toBe(false);
  });

  it('los lunes recuerda los atrasados aunque no haya novedades', async () => {
    const { repo, controls, daily } = setup();
    controls.byType = { [ControlType.WEIGHING]: { ...zero, overdue: 120 } };
    await daily.run('2026-11-23', 1);
    const rows = repo.rows.filter(
      (r) => r.type === NotificationType.WEIGHING_DUE,
    );
    expect(rows.map((r) => r.title)).toEqual([
      'Control de peso: 120 atrasados',
      'Control de peso: 120 atrasados',
    ]);
  });
});

describe('Envío push', () => {
  it('envía a los navegadores del usuario y borra las suscripciones anuladas', async () => {
    const { repo, controls, daily, sent, statusFor } = setup();
    repo.subs = [
      {
        id: 'a1',
        userId: 'admin',
        endpoint: 'https://fcm.googleapis.com/a1',
        p256dh: 'x',
        auth: 'y',
      },
      {
        id: 'a2',
        userId: 'admin',
        endpoint: 'https://fcm.googleapis.com/a2',
        p256dh: 'x',
        auth: 'y',
      },
      {
        id: 'v1',
        userId: 'vet',
        endpoint: 'https://fcm.googleapis.com/v1',
        p256dh: 'x',
        auth: 'y',
      },
    ];
    statusFor['https://fcm.googleapis.com/a2'] = 410;
    controls.births = [birth('s1', '2026-11-24')];
    await daily.run('2026-11-24', 2);
    expect(sent.map((s) => s.endpoint)).toEqual([
      'https://fcm.googleapis.com/a1',
      'https://fcm.googleapis.com/a2',
    ]);
    expect(sent[0].payload).toMatchObject({
      title: 'Parto probable hoy',
      target: { type: 'BREEDING_SERVICE', id: 's1', filter: null },
    });
    expect(repo.results).toEqual([
      ['a1', 'ok'],
      ['a2', 'gone'],
    ]);
    // Las claves VAPID se generaron una vez y quedaron guardadas.
    expect(repo.settings.vapidPublicKey).toBe('PUB');
  });
});

describe('Programador', () => {
  it('corre una vez al día, desde la hora configurada (hora de Bolivia)', async () => {
    const { repo, daily } = setup();
    const run = jest.spyOn(daily, 'run');
    const scheduler = new NotificationScheduler(
      repo as unknown as INotificationsRepository,
      daily,
      'America/La_Paz',
    );
    // 09:00 UTC = 05:00 en La Paz: todavía no.
    expect(await scheduler.tick(new Date('2026-11-24T09:00:00Z'))).toBe(false);
    // 10:05 UTC = 06:05: corre.
    expect(await scheduler.tick(new Date('2026-11-24T10:05:00Z'))).toBe(true);
    expect(run).toHaveBeenCalledWith('2026-11-24', 2);
    // Ya corrió hoy.
    expect(await scheduler.tick(new Date('2026-11-24T15:00:00Z'))).toBe(false);
    // Al día siguiente, aunque sea tarde (servidor apagado a las 06:00).
    expect(await scheduler.tick(new Date('2026-11-25T23:00:00Z'))).toBe(true);
    expect(repo.settings.lastRunOn).toBe('2026-11-25');
  });
});
