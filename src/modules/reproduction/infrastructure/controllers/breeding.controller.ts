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
import { BreedingEvaluationService } from '../../application/services/breeding-evaluation.service';
import { BreedingServicesService } from '../../application/use-cases/breeding-services.service';
import { BirthsService } from '../../application/use-cases/births.service';
import { ReproductionReportsService } from '../../application/use-cases/reproduction-reports.service';
import {
  BreedingCheckDto,
  CreateBreedingServiceDto,
  CreatePregnancyCheckDto,
  ListBreedingServicesQueryDto,
  RecordAbortionDto,
  UpdateBreedingServiceDto,
} from '../../application/dtos/breeding.dto';
import {
  ListBirthsQueryDto,
  RegisterBirthDto,
  RegisterUnplannedBirthDto,
  ReproductionStatsQueryDto,
  UpdateBirthDto,
} from '../../application/dtos/birth.dto';
import {
  AnimalReproductionPresenter,
  BirthPresenter,
  BreedingServicePresenter,
  PregnancyCheckPresenter,
} from '../presenters/reproduction.presenters';

@ApiTags('Reproducción')
@ApiBearerAuth()
@Controller()
export class BreedingController {
  constructor(
    private readonly evaluation: BreedingEvaluationService,
    private readonly services: BreedingServicesService,
    private readonly births: BirthsService,
    private readonly reports: ReproductionReportsService,
  ) {}

  // ---------- Montas ----------

  @Post('breeding/check')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({
    summary:
      'Revisar una pareja antes de registrar la monta: bloqueos, parentesco (3 generaciones), categoría esperada de la cría y avisos. No guarda nada.',
  })
  async check(@Body() dto: BreedingCheckDto) {
    return BreedingServicePresenter.evaluation(
      await this.evaluation.evaluate(dto),
    );
  }

  @Get('breeding/services')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({ summary: 'Listar montas (más recientes primero, paginado)' })
  async findServices(@Query() query: ListBreedingServicesQueryDto) {
    const result = await this.services.list(query);
    return {
      ...result,
      items: result.items.map((s) => BreedingServicePresenter.toResponse(s)),
    };
  }

  @Post('breeding/services')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({
    summary:
      'Registrar una monta. 409 KINSHIP_CONFLICT si la pareja está emparentada (se puede autorizar con overrideKinship), 409 OPEN_SERVICE si la hembra tiene otra monta abierta.',
  })
  async createService(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateBreedingServiceDto,
  ) {
    const { service, warnings } = await this.services.create(actor, dto);
    return BreedingServicePresenter.toResponse(service, warnings);
  }

  @Get('breeding/services/:id')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({ summary: 'Detalle de una monta con sus diagnósticos' })
  async findService(@Param('id', ParseUUIDPipe) id: string) {
    return BreedingServicePresenter.toResponse(await this.services.get(id));
  }

  @Patch('breeding/services/:id')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({
    summary:
      'Corregir la fecha, la pajuela, quién la hizo o las observaciones (la pareja no cambia)',
  })
  async updateService(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBreedingServiceDto,
  ) {
    return BreedingServicePresenter.toResponse(
      await this.services.update(actor.id, id, dto),
    );
  }

  @Delete('breeding/services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({
    summary:
      'Eliminar una monta sin parto (borrado lógico, con sus diagnósticos)',
  })
  async removeService(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.services.delete(actor.id, id);
  }

  @Post('breeding/services/:id/pregnancy-checks')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({
    summary:
      'Registrar un diagnóstico de preñez. El estado de la monta pasa a PREGNANT o EMPTY según el último diagnóstico.',
  })
  async addCheck(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePregnancyCheckDto,
  ) {
    const { service, check } = await this.services.addCheck(actor.id, id, dto);
    return {
      check: PregnancyCheckPresenter.toResponse(check),
      service: BreedingServicePresenter.toResponse(service),
    };
  }

  @Delete('breeding/services/:id/pregnancy-checks/:checkId')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({
    summary: 'Eliminar un diagnóstico cargado por error (devuelve la monta)',
  })
  async removeCheck(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checkId', ParseUUIDPipe) checkId: string,
  ) {
    return BreedingServicePresenter.toResponse(
      await this.services.removeCheck(actor.id, id, checkId),
    );
  }

  @Post('breeding/services/:id/abortion')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({ summary: 'Registrar un aborto (la monta pasa a ABORTED)' })
  async recordAbortion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordAbortionDto,
  ) {
    return BreedingServicePresenter.toResponse(
      await this.services.recordAbortion(actor.id, id, dto),
    );
  }

  @Delete('breeding/services/:id/abortion')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({ summary: 'Anular un aborto registrado por error' })
  async cancelAbortion(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return BreedingServicePresenter.toResponse(
      await this.services.cancelAbortion(actor.id, id),
    );
  }

  @Post('breeding/services/:id/birth')
  @RequirePermissions(
    PERMISSIONS.REPRODUCTION_WRITE,
    PERMISSIONS.ANIMALS_CREATE,
  )
  @ApiOperation({
    summary:
      'Registrar el parto de la monta. Crea las crías vivas como animales (con madre, padre, categoría esperada y pesaje de nacimiento). Las nacidas muertas solo cuentan para los indicadores.',
  })
  async registerBirth(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterBirthDto,
  ) {
    const { birth, animals, warnings } = await this.births.registerForService(
      actor.id,
      id,
      dto,
    );
    return BirthPresenter.toResponse(birth, { warnings, animals });
  }

  // ---------- Partos ----------

  @Get('breeding/births')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({ summary: 'Listar partos (más recientes primero, paginado)' })
  async findBirths(@Query() query: ListBirthsQueryDto) {
    const result = await this.births.list(query);
    return {
      ...result,
      items: result.items.map((b) => BirthPresenter.toResponse(b)),
    };
  }

  @Post('breeding/births')
  @RequirePermissions(
    PERMISSIONS.REPRODUCTION_WRITE,
    PERMISSIONS.ANIMALS_CREATE,
  )
  @ApiOperation({
    summary:
      'Registrar un parto sin monta registrada (padre opcional). Si la hembra tiene una monta abierta, responde 409 OPEN_SERVICE.',
  })
  async registerUnplannedBirth(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: RegisterUnplannedBirthDto,
  ) {
    const { birth, animals, warnings } = await this.births.registerUnplanned(
      actor.id,
      dto,
    );
    return BirthPresenter.toResponse(birth, { warnings, animals });
  }

  @Get('breeding/births/:id')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({ summary: 'Detalle de un parto con sus crías' })
  async findBirth(@Param('id', ParseUUIDPipe) id: string) {
    return BirthPresenter.toResponse(await this.births.get(id));
  }

  @Patch('breeding/births/:id')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_WRITE)
  @ApiOperation({
    summary:
      'Corregir la asistencia o las observaciones del parto (las crías se corrigen en cada animal)',
  })
  async updateBirth(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBirthDto,
  ) {
    return BirthPresenter.toResponse(
      await this.births.update(actor.id, id, dto),
    );
  }

  // ---------- Indicadores e historial ----------

  @Get('breeding/stats')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({
    summary:
      'Indicadores reproductivos: fertilidad, prolificidad, partos múltiples, mortalidad al nacer, intervalo entre partos y rendimiento por macho',
  })
  async stats(@Query() query: ReproductionStatsQueryDto) {
    return this.reports.stats(query);
  }

  @Get('animals/:animalId/reproduction')
  @RequirePermissions(PERMISSIONS.REPRODUCTION_READ)
  @ApiOperation({
    summary:
      'Historial reproductivo del animal: montas, partos (como madre o padre, y el parto en que nació) y resumen',
  })
  async animalHistory(@Param('animalId', ParseUUIDPipe) animalId: string) {
    return AnimalReproductionPresenter.toResponse(
      await this.reports.animalHistory(animalId),
    );
  }
}
