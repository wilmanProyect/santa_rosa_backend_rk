import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { NotificationsService } from '../application/notifications.service';
import { ControlsService } from '../application/controls.service';
import {
  JustifyControlsDto,
  ListControlsQueryDto,
  ListJustificationsQueryDto,
  ListNotificationsQueryDto,
  PushSubscriptionDto,
  UnsubscribeDto,
  UpdateNotificationSettingsDto,
} from '../application/notifications.dto';
import type { NotificationRow } from '../domain/notifications.repository.interface';

const present = (n: NotificationRow) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  body: n.body,
  target: n.targetType
    ? { type: n.targetType, id: n.targetId, filter: n.targetFilter }
    : null,
  createdAt: n.createdAt,
  readAt: n.readAt,
});

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Mis notificaciones (las más nuevas primero)' })
  async list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const page = await this.notifications.list(actor.id, query);
    return { ...page, items: page.items.map(present) };
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Cantidad de notificaciones sin leer (para la campana)',
  })
  async unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(actor.id) };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  async markRead(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notifications.markRead(actor.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Marcar todas como leídas' })
  async markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return { updated: await this.notifications.markAllRead(actor.id) };
  }

  @Get('push/public-key')
  @ApiOperation({
    summary:
      'Clave pública VAPID para suscribir el navegador (applicationServerKey)',
  })
  async publicKey() {
    return { publicKey: await this.notifications.publicKey() };
  }

  @Post('push/subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Registrar este navegador para recibir notificaciones push',
  })
  async subscribe(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: PushSubscriptionDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.notifications.subscribe(actor.id, dto, userAgent ?? null);
  }

  @Delete('push/subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Dejar de recibir notificaciones push en este navegador',
  })
  async unsubscribe(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UnsubscribeDto,
  ) {
    await this.notifications.unsubscribe(actor.id, dto.endpoint);
  }

  @Post('push/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar una notificación push de prueba a mis navegadores',
  })
  async test(@CurrentUser() actor: AuthenticatedUser) {
    return this.notifications.sendTest(actor.id);
  }
}

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_SETTINGS)
  @ApiOperation({ summary: 'Configuración de los controles y de los avisos' })
  settings() {
    return this.notifications.settings();
  }

  @Patch()
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_SETTINGS)
  @ApiOperation({
    summary:
      'Cambiar los meses entre controles, la edad de destete, la anticipación o la hora de la revisión diaria',
  })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    return this.notifications.updateSettings(actor.id, dto);
  }

  @Post('run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.NOTIFICATIONS_SETTINGS)
  @ApiOperation({
    summary:
      'Ejecutar ahora la revisión diaria (no repite los avisos ya enviados hoy)',
  })
  run() {
    return this.notifications.runNow();
  }
}

@ApiTags('Controles')
@ApiBearerAuth()
@Controller('controls')
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Controles por animal (destete, peso o sanitario) con su vencimiento. WEANING y WEIGHING requieren weighings:write; HEALTH, health:write',
  })
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListControlsQueryDto,
  ) {
    return this.controls.list(actor, query);
  }

  @Get('summary')
  @ApiOperation({
    summary:
      'Atrasados, de hoy y próximos de cada control que el usuario puede ver',
  })
  summary(@CurrentUser() actor: AuthenticatedUser) {
    return this.controls.summary(actor);
  }

  @Post('justifications')
  @ApiOperation({
    summary:
      'Justificar por qué no se hizo un control (uno o varios animales) y reprogramarlo',
  })
  justify(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: JustifyControlsDto,
  ) {
    return this.controls.justify(actor, dto);
  }

  @Get('justifications')
  @ApiOperation({
    summary: 'Historial de justificaciones (de un animal o un tipo)',
  })
  history(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListJustificationsQueryDto,
  ) {
    return this.controls.history(actor, query);
  }
}
