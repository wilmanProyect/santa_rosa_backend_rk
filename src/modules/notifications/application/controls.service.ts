import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Paginated } from '@shared/domain/paginated';
import {
  CONTROL_LABEL,
  CONTROL_PERMISSION,
  ControlType,
} from '../domain/notification.enums';
import { assertJustification } from '../domain/notification-rules';
import {
  CONTROLS_REPOSITORY,
  ControlCounts,
  ControlItem,
  JustificationRow,
  NOTIFICATIONS_REPOSITORY,
} from '../domain/notifications.repository.interface';
import type {
  IControlsRepository,
  INotificationsRepository,
} from '../domain/notifications.repository.interface';
import { FARM_TIME_ZONE, farmNow } from './farm-clock';
import {
  ControlStateFilter,
  JustifyControlsDto,
  ListControlsQueryDto,
  ListJustificationsQueryDto,
} from './notifications.dto';

interface Actor {
  id: string;
  permissions: string[];
}

@Injectable()
export class ControlsService {
  constructor(
    @Inject(CONTROLS_REPOSITORY)
    private readonly controls: IControlsRepository,
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repository: INotificationsRepository,
    @Inject(FARM_TIME_ZONE) private readonly timeZone: string,
  ) {}

  async list(
    actor: Actor,
    query: ListControlsQueryDto,
  ): Promise<Paginated<ControlItem> & { today: string }> {
    this.assertCan(actor, query.type);
    const today = farmNow(this.timeZone).date;
    const page = await this.controls.find(
      {
        type: query.type,
        settings: await this.repository.getSettings(),
        today,
        state: query.state ?? ControlStateFilter.PENDING,
        search: query.search,
      },
      { page: query.page, limit: query.limit },
    );
    return { ...page, today };
  }

  /** Conteos de los controles que el usuario puede ver (para el tablero). */
  async summary(actor: Actor): Promise<{
    today: string;
    controls: Partial<Record<ControlType, ControlCounts>>;
  }> {
    const today = farmNow(this.timeZone).date;
    const settings = await this.repository.getSettings();
    const controls: Partial<Record<ControlType, ControlCounts>> = {};
    for (const type of Object.values(ControlType)) {
      if (!actor.permissions.includes(CONTROL_PERMISSION[type])) continue;
      controls[type] = await this.controls.counts(type, settings, today);
    }
    return { today, controls };
  }

  /**
   * Justifica uno o varios controles que no se hicieron (o no se harán) en su
   * fecha. Vale para el vencimiento actual de cada animal: si después se
   * registra el control, el siguiente vencimiento se calcula normalmente.
   */
  async justify(
    actor: Actor,
    dto: JustifyControlsDto,
  ): Promise<{ justified: number; items: ControlItem[] }> {
    this.assertCan(actor, dto.type);
    const today = farmNow(this.timeZone).date;
    const nextDueDate = dto.nextDueDate ?? null;
    // DomainError → 400 (DomainExceptionFilter).
    assertJustification(
      { type: dto.type, reason: dto.reason, nextDueDate },
      today,
    );
    const settings = await this.repository.getSettings();
    const current = await this.controls.find({
      type: dto.type,
      settings,
      today,
      animalIds: dto.animalIds,
    });
    const found = new Set(current.items.map((i) => i.animalId));
    const missing = dto.animalIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: `${missing.length} animal(es) no tienen un ${CONTROL_LABEL[dto.type].toLowerCase()} pendiente (no existen, no están vivos, ya se registró o ya está cerrado).`,
        animalIds: missing,
      });
    }
    if (nextDueDate) {
      const early = current.items.filter((i) => nextDueDate <= i.baseDueDate);
      if (early.length > 0) {
        throw new BadRequestException(
          `La nueva fecha debe ser posterior al vencimiento original (${early[0].baseDueDate}${early.length > 1 ? ` y ${early.length - 1} más` : ''})`,
        );
      }
    }
    await this.controls.insertJustifications(
      current.items.map((i) => ({
        animalId: i.animalId,
        type: dto.type,
        resolvedDueDate: i.baseDueDate,
        nextDueDate,
        reason: dto.reason.trim(),
        createdBy: actor.id,
      })),
    );
    const after = nextDueDate
      ? (
          await this.controls.find({
            type: dto.type,
            settings,
            today,
            animalIds: dto.animalIds,
          })
        ).items
      : [];
    return { justified: current.items.length, items: after };
  }

  async history(
    actor: Actor,
    query: ListJustificationsQueryDto,
  ): Promise<JustificationRow[]> {
    if (query.type) this.assertCan(actor, query.type);
    const rows = await this.controls.justifications(query);
    // Solo los tipos de control que el usuario puede ver.
    return rows.filter((r) =>
      actor.permissions.includes(CONTROL_PERMISSION[r.type]),
    );
  }

  private assertCan(actor: Actor, type: ControlType): void {
    const permission = CONTROL_PERMISSION[type];
    if (!actor.permissions.includes(permission)) {
      throw new ForbiddenException(
        `Ver y justificar el ${CONTROL_LABEL[type].toLowerCase()} requiere el permiso ${permission}`,
      );
    }
  }
}
