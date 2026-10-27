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
import { CreateBreedUseCase } from '../../application/use-cases/breeds/create-breed.use-case';
import { UpdateBreedUseCase } from '../../application/use-cases/breeds/update-breed.use-case';
import { GetBreedUseCase } from '../../application/use-cases/breeds/get-breed.use-case';
import { ListBreedsUseCase } from '../../application/use-cases/breeds/list-breeds.use-case';
import { DeleteBreedUseCase } from '../../application/use-cases/breeds/delete-breed.use-case';
import { CreateBreedDto } from '../../application/dtos/create-breed.dto';
import { UpdateBreedDto } from '../../application/dtos/update-breed.dto';
import { ListBreedsQueryDto } from '../../application/dtos/list-breeds-query.dto';
import { BreedPresenter } from '../presenters/breed.presenter';

@ApiTags('Razas')
@ApiBearerAuth()
@Controller('breeds')
export class BreedController {
  constructor(
    private readonly createBreedUseCase: CreateBreedUseCase,
    private readonly updateBreedUseCase: UpdateBreedUseCase,
    private readonly getBreedUseCase: GetBreedUseCase,
    private readonly listBreedsUseCase: ListBreedsUseCase,
    private readonly deleteBreedUseCase: DeleteBreedUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ANIMAL_CATALOGS_MANAGE)
  @ApiOperation({ summary: 'Crear una raza' })
  @ApiResponse({ status: 201, description: 'Raza creada.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateBreedDto,
  ) {
    const breed = await this.createBreedUseCase.execute(actor.id, dto);
    return BreedPresenter.toResponse(breed);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({ summary: 'Listar razas' })
  async findAll(@Query() query: ListBreedsQueryDto) {
    const breeds = await this.listBreedsUseCase.execute({
      species: query.species,
      isActive: query.isActive,
    });
    return breeds.map((breed) => BreedPresenter.toResponse(breed));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ANIMALS_READ)
  @ApiOperation({ summary: 'Obtener una raza' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const breed = await this.getBreedUseCase.execute(id);
    return BreedPresenter.toResponse(breed);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ANIMAL_CATALOGS_MANAGE)
  @ApiOperation({ summary: 'Actualizar una raza (especie, nombre, estado)' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBreedDto,
  ) {
    const breed = await this.updateBreedUseCase.execute(actor.id, id, dto);
    return BreedPresenter.toResponse(breed);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ANIMAL_CATALOGS_MANAGE)
  @ApiOperation({
    summary: 'Eliminar una raza (solo si ningún animal la tiene)',
  })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteBreedUseCase.execute(actor.id, id);
  }
}
