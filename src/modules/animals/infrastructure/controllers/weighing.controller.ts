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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { WeighingService } from '../../application/use-cases/weighings/weighing.use-cases';
import {
  BatchWeighingDto,
  CreateWeighingDto,
  UpdateWeighingDto,
} from '../../application/dtos/weighing.dto';
import { WeighingPresenter } from '../presenters/weighing.presenter';

@ApiTags('Control de peso')
@ApiBearerAuth()
@Controller()
export class WeighingController {
  constructor(private readonly weighings: WeighingService) {}

  @Get('animals/:animalId/weighings')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({
    summary:
      'Historial de pesajes del animal (del más antiguo al más reciente), con edad y ganancia diaria',
  })
  async findAll(@Param('animalId', ParseUUIDPipe) animalId: string) {
    const items = await this.weighings.list(animalId);
    return items.map((item) => WeighingPresenter.withMetrics(item));
  }

  @Post('animals/:animalId/weighings')
  @RequirePermissions(PERMISSIONS.WEIGHINGS_WRITE)
  @ApiOperation({
    summary:
      'Registrar un pesaje (la respuesta trae advertencias si el dato parece un error)',
  })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Body() dto: CreateWeighingDto,
  ) {
    const { weighing, warnings } = await this.weighings.create(
      actor.id,
      animalId,
      dto,
    );
    return WeighingPresenter.toResponse(weighing, warnings);
  }

  @Patch('animals/:animalId/weighings/:id')
  @RequirePermissions(PERMISSIONS.WEIGHINGS_WRITE)
  @ApiOperation({ summary: 'Corregir un pesaje' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWeighingDto,
  ) {
    const { weighing, warnings } = await this.weighings.update(
      actor.id,
      animalId,
      id,
      dto,
    );
    return WeighingPresenter.toResponse(weighing, warnings);
  }

  @Delete('animals/:animalId/weighings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.WEIGHINGS_WRITE)
  @ApiOperation({ summary: 'Eliminar un pesaje (borrado lógico)' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.weighings.delete(actor.id, animalId, id);
  }

  @Post('weighings/batch')
  @RequirePermissions(PERMISSIONS.WEIGHINGS_WRITE)
  @ApiOperation({
    summary:
      'Jornada de pesaje: varios animales con la misma fecha y motivo (todo o nada)',
  })
  async batch(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: BatchWeighingDto,
  ) {
    const results = await this.weighings.batch(actor.id, dto);
    return results.map((r) =>
      WeighingPresenter.toResponse(r.weighing, r.warnings),
    );
  }
}
