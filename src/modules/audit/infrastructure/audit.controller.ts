import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { AuditService } from '../application/audit.service';
import {
  ActivityQueryDto,
  AnimalActivityQueryDto,
} from '../application/audit.dto';

@ApiTags('Auditoría')
@ApiBearerAuth()
@Controller()
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('audit/activity')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({
    summary:
      'Historial de actividad: altas, modificaciones y borrados de datos, y acciones (certificados, respaldos)',
  })
  activity(@Query() query: ActivityQueryDto) {
    const { page, limit, ...filters } = query;
    return this.audit.list(filters, { page, limit });
  }

  @Get('audit/entities')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({ summary: 'Tablas registradas y su nombre, para el filtro' })
  entities() {
    return this.audit.entities();
  }

  @Get('animals/:animalId/activity')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  @ApiOperation({
    summary:
      'Historial de cambios de un animal: su ficha, pesajes, sanidad, fotos, montas y partos',
  })
  animalActivity(
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Query() query: AnimalActivityQueryDto,
  ) {
    const { page, limit, ...filters } = query;
    return this.audit.animalActivity(animalId, filters, { page, limit });
  }
}
