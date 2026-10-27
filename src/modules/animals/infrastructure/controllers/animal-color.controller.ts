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
import { CreateAnimalColorUseCase } from '../../application/use-cases/colors/create-animal-color.use-case';
import { UpdateAnimalColorUseCase } from '../../application/use-cases/colors/update-animal-color.use-case';
import { GetAnimalColorUseCase } from '../../application/use-cases/colors/get-animal-color.use-case';
import { ListAnimalColorsUseCase } from '../../application/use-cases/colors/list-animal-colors.use-case';
import { DeleteAnimalColorUseCase } from '../../application/use-cases/colors/delete-animal-color.use-case';
import { CreateAnimalColorDto } from '../../application/dtos/create-animal-color.dto';
import { UpdateAnimalColorDto } from '../../application/dtos/update-animal-color.dto';
import { ListAnimalColorsQueryDto } from '../../application/dtos/list-animal-colors-query.dto';
import { AnimalColorPresenter } from '../presenters/animal-color.presenter';

@ApiTags('Colores')
@ApiBearerAuth()
@Controller('animal-colors')
export class AnimalColorController {
  constructor(
    private readonly createAnimalColorUseCase: CreateAnimalColorUseCase,
    private readonly updateAnimalColorUseCase: UpdateAnimalColorUseCase,
    private readonly getAnimalColorUseCase: GetAnimalColorUseCase,
    private readonly listAnimalColorsUseCase: ListAnimalColorsUseCase,
    private readonly deleteAnimalColorUseCase: DeleteAnimalColorUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ANIMAL_CATALOGS_MANAGE)
  @ApiOperation({ summary: 'Crear un color' })
  @ApiResponse({ status: 201, description: 'Color creado.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateAnimalColorDto,
  ) {
    const color = await this.createAnimalColorUseCase.execute(actor.id, dto);
    return AnimalColorPresenter.toResponse(color);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({ summary: 'Listar colores' })
  async findAll(@Query() query: ListAnimalColorsQueryDto) {
    const colors = await this.listAnimalColorsUseCase.execute({
      isActive: query.isActive,
    });
    return colors.map((color) => AnimalColorPresenter.toResponse(color));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({ summary: 'Obtener un color' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const color = await this.getAnimalColorUseCase.execute(id);
    return AnimalColorPresenter.toResponse(color);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ANIMAL_CATALOGS_MANAGE)
  @ApiOperation({ summary: 'Actualizar un color (nombre, estado)' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnimalColorDto,
  ) {
    const color = await this.updateAnimalColorUseCase.execute(
      actor.id,
      id,
      dto,
    );
    return AnimalColorPresenter.toResponse(color);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ANIMAL_CATALOGS_MANAGE)
  @ApiOperation({
    summary: 'Eliminar un color (solo si ningún animal lo tiene)',
  })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteAnimalColorUseCase.execute(actor.id, id);
  }
}
