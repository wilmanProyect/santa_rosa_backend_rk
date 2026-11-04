import {
  Body,
  Controller,
  Delete,
  Get,
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
import { HealthRecordService } from '../../application/use-cases/health/health-record.service';
import {
  BatchHealthRecordDto,
  CreateHealthRecordDto,
  ListHealthRecordsQueryDto,
  UpdateHealthRecordDto,
} from '../../application/dtos/health-record.dto';
import { typesOfCategory } from '../../domain/models/health-record.model';
import { HealthRecordPresenter } from '../presenters/health-record.presenter';

@ApiTags('Registro sanitario')
@ApiBearerAuth()
@Controller('health-records')
export class HealthRecordController {
  constructor(private readonly health: HealthRecordService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.HEALTH_WRITE)
  @ApiOperation({
    summary:
      'Registrar un evento sanitario o de manejo de un animal, o un evento general de instalaciones',
  })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateHealthRecordDto,
  ) {
    return HealthRecordPresenter.toResponse(
      await this.health.create(actor.id, dto),
    );
  }

  @Post('batch')
  @RequirePermissions(PERMISSIONS.HEALTH_WRITE)
  @ApiOperation({
    summary:
      'Aplicación masiva: mismo evento (vacuna, desparasitación...) para varios animales, todo o nada',
  })
  async batch(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BatchHealthRecordDto,
  ) {
    const records = await this.health.batch(actor.id, dto);
    return records.map((r) => HealthRecordPresenter.toResponse(r));
  }

  @Get()
  @RequirePermissions(PERMISSIONS.HEALTH_READ)
  @ApiOperation({
    summary: 'Listar eventos (paginado, del más reciente al más antiguo)',
  })
  async findAll(@Query() query: ListHealthRecordsQueryDto) {
    const types = query.type
      ? [query.type]
      : query.category
        ? typesOfCategory(query.category)
        : undefined;
    const result = await this.health.list(
      {
        animalId: query.animalId,
        generalOnly: query.general,
        types,
        productId: query.productId,
        targetCondition: query.targetCondition,
        from: query.from,
        to: query.to,
      },
      { page: query.page, limit: query.limit },
    );
    return {
      ...result,
      items: result.items.map((r) => HealthRecordPresenter.toResponse(r)),
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.HEALTH_READ)
  @ApiOperation({ summary: 'Obtener un evento' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return HealthRecordPresenter.toResponse(await this.health.get(id));
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.HEALTH_WRITE)
  @ApiOperation({ summary: 'Corregir un evento' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHealthRecordDto,
  ) {
    return HealthRecordPresenter.toResponse(
      await this.health.update(actor.id, id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.HEALTH_WRITE)
  @ApiOperation({ summary: 'Eliminar un evento (borrado lógico)' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.health.delete(actor.id, id);
  }
}
