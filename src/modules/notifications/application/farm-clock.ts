/** Fecha, hora y día de la semana en la zona horaria de la cabaña. */
export interface FarmNow {
  /** YYYY-MM-DD */
  date: string;
  hour: number;
  /** 0 = domingo, 1 = lunes... */
  weekday: number;
}

export const FARM_TIME_ZONE = Symbol('FARM_TIME_ZONE');

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function farmNow(timeZone: string, now: Date = new Date()): FarmNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** "2026-12-01" → "01/12/2026" */
export const formatDate = (date: string) => date.split('-').reverse().join('/');
