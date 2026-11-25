import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { NOTIFICATIONS_REPOSITORY } from '../domain/notifications.repository.interface';
import type { INotificationsRepository } from '../domain/notifications.repository.interface';
import { DailyAlertsService } from '../application/daily-alerts.service';
import { FARM_TIME_ZONE, farmNow } from '../application/farm-clock';

const CHECK_EVERY_MS = 5 * 60_000;
const FIRST_CHECK_MS = 30_000;

/**
 * Lanza la revisión diaria a la hora configurada (hora de la cabaña), sin
 * librerías externas: revisa cada 5 minutos si ya toca. Si el servidor estuvo
 * apagado a esa hora, la revisión corre apenas vuelve.
 *
 * Solo lo arranca main.ts (la API), no los comandos de terminal.
 */
@Injectable()
export class NotificationScheduler implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
    private readonly daily: DailyAlertsService,
    @Inject(FARM_TIME_ZONE) private readonly timeZone: string,
  ) {}

  start(): void {
    if (this.timer || process.env.NOTIFICATIONS_SCHEDULER === 'false') return;
    this.first = setTimeout(() => void this.tick(), FIRST_CHECK_MS);
    this.timer = setInterval(() => void this.tick(), CHECK_EVERY_MS);
    this.timer.unref();
    this.first.unref();
    this.logger.log('Revisión diaria de avisos programada');
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.first) clearTimeout(this.first);
    this.timer = this.first = null;
  }

  async tick(now: Date = new Date()): Promise<boolean> {
    if (this.running) return false;
    this.running = true;
    try {
      const settings = await this.repository.getSettings();
      const farm = farmNow(this.timeZone, now);
      if (farm.hour < settings.runHour || settings.lastRunOn === farm.date) {
        return false;
      }
      await this.daily.run(farm.date, farm.weekday);
      await this.repository.setLastRun(farm.date);
      return true;
    } catch (error) {
      // Se reintenta en la próxima revisión (cada 5 minutos).
      this.logger.error(
        `La revisión diaria de avisos falló: ${(error as Error).message}`,
      );
      return false;
    } finally {
      this.running = false;
    }
  }
}
