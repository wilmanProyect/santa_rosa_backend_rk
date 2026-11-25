import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '@modules/users/users.module';
import {
  CONTROLS_REPOSITORY,
  NOTIFICATIONS_REPOSITORY,
} from './domain/notifications.repository.interface';
import { NotificationsTypeormRepository } from './infrastructure/persistence/notifications.typeorm.repository';
import { ControlsTypeormRepository } from './infrastructure/persistence/controls.typeorm.repository';
import {
  NotificationDispatcher,
  VAPID_KEY_GENERATOR,
  VAPID_SUBJECT,
  WEB_PUSH_SENDER,
} from './application/notification-dispatcher.service';
import { DailyAlertsService } from './application/daily-alerts.service';
import { NotificationsService } from './application/notifications.service';
import { ControlsService } from './application/controls.service';
import { FARM_TIME_ZONE } from './application/farm-clock';
import { NotificationScheduler } from './infrastructure/notification-scheduler';
import {
  ControlsController,
  NotificationSettingsController,
  NotificationsController,
} from './infrastructure/notifications.controller';
import { generateVapidKeys, sendWebPush } from './infrastructure/push/web-push';

/**
 * Notificaciones (campana y push del navegador) y controles por animal:
 * partos próximos, destete, control de peso y control sanitario, con sus
 * justificaciones. Todo corre en el propio servidor: la revisión diaria la
 * lanza NotificationScheduler y los push se cifran con `crypto` (Web Push).
 */
@Module({
  imports: [UsersModule],
  controllers: [
    NotificationsController,
    NotificationSettingsController,
    ControlsController,
  ],
  providers: [
    {
      provide: NOTIFICATIONS_REPOSITORY,
      useClass: NotificationsTypeormRepository,
    },
    { provide: CONTROLS_REPOSITORY, useClass: ControlsTypeormRepository },
    { provide: WEB_PUSH_SENDER, useValue: sendWebPush },
    { provide: VAPID_KEY_GENERATOR, useValue: generateVapidKeys },
    {
      provide: FARM_TIME_ZONE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('FARM_TIME_ZONE', 'America/La_Paz'),
    },
    {
      // Contacto que exigen los servicios de push (Apple lo valida).
      provide: VAPID_SUBJECT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const explicit = config.get<string>('VAPID_SUBJECT');
        if (explicit) return explicit;
        const origin = (config.get<string>('CORS_ORIGINS') ?? '')
          .split(',')
          .map((o) => o.trim())
          .find((o) => o.startsWith('https://'));
        return origin ?? 'mailto:admin@example.com';
      },
    },
    NotificationDispatcher,
    DailyAlertsService,
    NotificationsService,
    ControlsService,
    NotificationScheduler,
  ],
  exports: [NotificationDispatcher, NotificationScheduler],
})
export class NotificationsModule {}
