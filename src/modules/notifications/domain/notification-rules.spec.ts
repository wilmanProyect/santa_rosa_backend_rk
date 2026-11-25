import { DomainError } from '@shared/domain/errors/domain.error';
import { ControlType } from './notification.enums';
import {
  assertJustification,
  assertSettings,
  birthAlertStage,
  birthAlertTitle,
  controlState,
} from './notification-rules';
import { farmNow } from '../application/farm-clock';
import { assertPushEndpoint } from '../application/notifications.service';

describe('Avisos de parto', () => {
  it('avisa a 10, 5, 2, 1 y 0 días', () => {
    expect([10, 5, 2, 1, 0].map(birthAlertStage)).toEqual([10, 5, 2, 1, 0]);
  });

  it('si un día no corrió la revisión, al siguiente se envía la etapa pendiente', () => {
    expect(birthAlertStage(9)).toBe(10);
    expect(birthAlertStage(4)).toBe(5);
    expect(birthAlertStage(3)).toBe(5);
  });

  it('no avisa con más de 10 días ni después del parto', () => {
    expect(birthAlertStage(11)).toBeNull();
    expect(birthAlertStage(-1)).toBeNull();
  });

  it('títulos', () => {
    expect(birthAlertTitle(0)).toBe('Parto probable hoy');
    expect(birthAlertTitle(1)).toBe('Parto probable mañana');
    expect(birthAlertTitle(5)).toBe('Parto probable en 5 días');
  });
});

describe('Justificación de un control', () => {
  const today = '2026-11-24';

  it('peso y sanidad exigen una nueva fecha posterior a hoy', () => {
    for (const type of [ControlType.WEIGHING, ControlType.HEALTH]) {
      expect(() =>
        assertJustification(
          { type, reason: 'Sin balanza', nextDueDate: null },
          today,
        ),
      ).toThrow(/nueva fecha/);
      expect(() =>
        assertJustification(
          { type, reason: 'Sin balanza', nextDueDate: today },
          today,
        ),
      ).toThrow(/posterior a hoy/);
      expect(() =>
        assertJustification(
          { type, reason: 'Sin balanza', nextDueDate: '2026-12-10' },
          today,
        ),
      ).not.toThrow();
    }
  });

  it('el destete sin fecha se cierra', () => {
    expect(() =>
      assertJustification(
        {
          type: ControlType.WEANING,
          reason: 'Destetado antes del sistema',
          nextDueDate: null,
        },
        today,
      ),
    ).not.toThrow();
  });

  it('exige un motivo y no reprograma a más de un año', () => {
    expect(() =>
      assertJustification(
        { type: ControlType.WEANING, reason: ' no ', nextDueDate: null },
        today,
      ),
    ).toThrow(DomainError);
    expect(() =>
      assertJustification(
        {
          type: ControlType.HEALTH,
          reason: 'Sin veterinario',
          nextDueDate: '2028-01-01',
        },
        today,
      ),
    ).toThrow(/un año/);
  });
});

describe('Estado de un control', () => {
  it('atrasado, hoy, próximo o más adelante', () => {
    const t = '2026-11-24';
    expect(controlState('2026-11-23', t, 7)).toBe('OVERDUE');
    expect(controlState('2026-11-24', t, 7)).toBe('TODAY');
    expect(controlState('2026-12-01', t, 7)).toBe('UPCOMING');
    expect(controlState('2026-12-02', t, 7)).toBe('LATER');
  });
});

describe('Configuración', () => {
  const ok = {
    weighingIntervalMonths: 3,
    healthIntervalMonths: 3,
    weaningAgeMonths: 3,
    weaningTrackingFrom: '2026-05-24',
    upcomingDays: 7,
    runHour: 6,
  };
  it('acepta valores válidos y rechaza los fuera de rango', () => {
    expect(() => assertSettings(ok, '2026-11-24')).not.toThrow();
    expect(() =>
      assertSettings({ ...ok, weighingIntervalMonths: 0 }, '2026-11-24'),
    ).toThrow(/entre 1 y 24/);
    expect(() => assertSettings({ ...ok, runHour: 24 }, '2026-11-24')).toThrow(
      DomainError,
    );
    expect(() =>
      assertSettings(
        { ...ok, weaningTrackingFrom: '2026-12-01' },
        '2026-11-24',
      ),
    ).toThrow(/futura/);
  });
});

describe('Reloj de la cabaña', () => {
  it('usa la fecha y hora de Bolivia, no la de UTC', () => {
    // 2026-11-24 02:30 UTC = 2026-11-23 22:30 en La Paz (lunes).
    expect(farmNow('America/La_Paz', new Date('2026-11-24T02:30:00Z'))).toEqual(
      {
        date: '2026-11-23',
        hour: 22,
        weekday: 1,
      },
    );
  });
});

describe('Suscripciones push', () => {
  it('solo acepta servicios de push conocidos por https', () => {
    for (const ok of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(() => assertPushEndpoint(ok)).not.toThrow();
    }
    for (const bad of [
      'http://fcm.googleapis.com/fcm/send/abc',
      'https://garage:3900/santa-rosa',
      'https://127.0.0.1/x',
      'https://evil-fcm.googleapis.com.attacker.com/x',
      'no es url',
    ]) {
      expect(() => assertPushEndpoint(bad)).toThrow();
    }
  });
});
