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
import {
  CreateVeterinaryProductUseCase,
  DeleteVeterinaryProductUseCase,
  GetVeterinaryProductUseCase,
  ListVeterinaryProductsUseCase,
  UpdateVeterinaryProductUseCase,
} from '../../application/use-cases/veterinary-product.use-cases';
import { CreateVeterinaryProductDto } from '../../application/dtos/create-veterinary-product.dto';
import { UpdateVeterinaryProductDto } from '../../application/dtos/update-veterinary-product.dto';
import { ListVeterinaryProductsQueryDto } from '../../application/dtos/list-veterinary-products-query.dto';
import { VeterinaryProductPresenter } from '../presenters/veterinary-product.presenter';

@ApiTags('Productos veterinarios')
@ApiBearerAuth()
@Controller('veterinary-products')
export class VeterinaryProductController {
  constructor(
    private readonly createProduct: CreateVeterinaryProductUseCase,
    private readonly updateProduct: UpdateVeterinaryProductUseCase,
    private readonly getProduct: GetVeterinaryProductUseCase,
    private readonly listProducts: ListVeterinaryProductsUseCase,
    private readonly deleteProduct: DeleteVeterinaryProductUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.VETERINARY_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Crear un producto veterinario' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateVeterinaryProductDto,
  ) {
    return VeterinaryProductPresenter.toResponse(
      await this.createProduct.execute(actor.id, dto),
    );
  }

  @Get()
  @RequirePermissions(PERMISSIONS.HEALTH_READ)
  @ApiOperation({ summary: 'Listar productos veterinarios' })
  async findAll(@Query() query: ListVeterinaryProductsQueryDto) {
    const products = await this.listProducts.execute(query);
    return products.map((p) => VeterinaryProductPresenter.toResponse(p));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.HEALTH_READ)
  @ApiOperation({ summary: 'Obtener un producto veterinario' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return VeterinaryProductPresenter.toResponse(
      await this.getProduct.execute(id),
    );
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.VETERINARY_PRODUCTS_MANAGE)
  @ApiOperation({ summary: 'Actualizar un producto veterinario' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVeterinaryProductDto,
  ) {
    return VeterinaryProductPresenter.toResponse(
      await this.updateProduct.execute(actor.id, id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.VETERINARY_PRODUCTS_MANAGE)
  @ApiOperation({
    summary: 'Eliminar un producto (solo si no figura en registros sanitarios)',
  })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteProduct.execute(actor.id, id);
  }
}
