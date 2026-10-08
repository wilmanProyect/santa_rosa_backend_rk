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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { CreateAreaUseCase } from '../../application/use-cases/create-area.use-case';
import { UpdateAreaUseCase } from '../../application/use-cases/update-area.use-case';
import { GetAreaUseCase } from '../../application/use-cases/get-area.use-case';
import { ListAreasUseCase } from '../../application/use-cases/list-areas.use-case';
import { DeleteAreaUseCase } from '../../application/use-cases/delete-area.use-case';
import { CreateAreaDto } from '../../application/dtos/create-area.dto';
import { UpdateAreaDto } from '../../application/dtos/update-area.dto';
import { ListAreasQueryDto } from '../../application/dtos/list-areas-query.dto';
import { AreaPresenter } from '../presenters/area.presenter';

@ApiTags('Áreas')
@ApiBearerAuth()
@Controller('areas')
export class AreaController {
  constructor(
    private readonly createAreaUseCase: CreateAreaUseCase,
    private readonly updateAreaUseCase: UpdateAreaUseCase,
    private readonly getAreaUseCase: GetAreaUseCase,
    private readonly listAreasUseCase: ListAreasUseCase,
    private readonly deleteAreaUseCase: DeleteAreaUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.AREAS_CREATE)
  @ApiOperation({ summary: 'Crear un área' })
  @ApiResponse({ status: 201, description: 'Área creada.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAreaDto,
  ) {
    const area = await this.createAreaUseCase.execute(actor.id, dto);
    return AreaPresenter.toResponse(area);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.AREAS_READ)
  @ApiOperation({ summary: 'Listar áreas' })
  async findAll(@Query() query: ListAreasQueryDto) {
    const areas = await this.listAreasUseCase.execute({
      isActive: query.isActive,
    });
    return areas.map((area) => AreaPresenter.toResponse(area));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.AREAS_READ)
  @ApiOperation({ summary: 'Obtener un área' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const area = await this.getAreaUseCase.execute(id);
    return AreaPresenter.toResponse(area);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.AREAS_UPDATE)
  @ApiOperation({ summary: 'Actualizar un área (nombre, descripción, estado)' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaDto,
  ) {
    const area = await this.updateAreaUseCase.execute(actor.id, id, dto);
    return AreaPresenter.toResponse(area);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.AREAS_DELETE)
  @ApiOperation({
    summary: 'Eliminar un área (solo si no tiene usuarios ni roles)',
  })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteAreaUseCase.execute(actor.id, id);
  }
}
