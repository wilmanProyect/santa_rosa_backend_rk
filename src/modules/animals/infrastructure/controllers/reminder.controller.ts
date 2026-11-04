import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { toDateOnly } from '@shared/domain/date-only';
import { WeighingService } from '../../application/use-cases/weighings/weighing.use-cases';
import { HealthRecordService } from '../../application/use-cases/health/health-record.service';
import { PendingQueryDto } from '../../application/dtos/weighing.dto';

@ApiTags('Recordatorios')
@ApiBearerAuth()
@Controller('reminders')
export class ReminderController {
  constructor(
    private readonly weighings: WeighingService,
    private readonly health: HealthRecordService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ANIMALS_READ, PERMISSIONS.HEALTH_READ)
  @ApiOperation({
    summary:
      'Próximos pesajes y próximas dosis programados (incluye los atrasados)',
  })
  async findAll(@Query() query: PendingQueryDto) {
    const today = toDateOnly(new Date());
    const [weighings, doses] = await Promise.all([
      this.weighings.pending(query.until),
      this.health.pending(query.until),
    ]);
    return {
      weighings: weighings.map((w) => ({
        ...w,
        overdue: w.nextWeighingAt < today,
      })),
      healthDoses: doses.map((d) => ({ ...d, overdue: d.nextDoseAt < today })),
    };
  }
}
