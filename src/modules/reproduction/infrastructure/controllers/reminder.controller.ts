import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { toDateOnly } from '@shared/domain/date-only';
import { WeighingService } from '@modules/animals/application/use-cases/weighings/weighing.use-cases';
import { HealthRecordService } from '@modules/animals/application/use-cases/health/health-record.service';
import { PendingQueryDto } from '@modules/animals/application/dtos/weighing.dto';
import { ReproductionReportsService } from '../../application/use-cases/reproduction-reports.service';

/**
 * Agenda de la cabaña. Vive en el módulo de reproducción porque reúne pesajes
 * y dosis (módulo de animales) con diagnósticos y partos.
 */
@ApiTags('Recordatorios')
@ApiBearerAuth()
@Controller('reminders')
export class ReminderController {
  constructor(
    private readonly weighings: WeighingService,
    private readonly health: HealthRecordService,
    private readonly reproduction: ReproductionReportsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ANIMALS_READ, PERMISSIONS.HEALTH_READ)
  @ApiOperation({
    summary:
      'Próximos pesajes, dosis, diagnósticos de preñez y partos (incluye los atrasados). Diagnósticos y partos solo con reproduction:read.',
  })
  async findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: PendingQueryDto,
  ) {
    const today = toDateOnly(new Date());
    const canSeeReproduction = actor.permissions.includes(
      PERMISSIONS.REPRODUCTION_READ,
    );
    const [weighings, doses, reproduction] = await Promise.all([
      this.weighings.pending(query.until),
      this.health.pending(query.until),
      canSeeReproduction ? this.reproduction.reminders(query.until) : null,
    ]);
    return {
      weighings: weighings.map((w) => ({
        ...w,
        overdue: w.nextWeighingAt < today,
      })),
      healthDoses: doses.map((d) => ({ ...d, overdue: d.nextDoseAt < today })),
      pregnancyChecks: reproduction?.pregnancyChecks ?? [],
      upcomingBirths: reproduction?.upcomingBirths ?? [],
    };
  }
}
