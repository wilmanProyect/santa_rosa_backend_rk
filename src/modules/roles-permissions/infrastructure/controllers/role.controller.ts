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
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import { PERMISSIONS } from '../../domain/permission-catalog';
import { CreateRoleUseCase } from '../../application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from '../../application/use-cases/update-role.use-case';
import { GetRoleUseCase } from '../../application/use-cases/get-role.use-case';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';
import { DeleteRoleUseCase } from '../../application/use-cases/delete-role.use-case';
import { ListPermissionsUseCase } from '../../application/use-cases/list-permissions.use-case';
import { CreateRoleDto } from '../../application/dtos/create-role.dto';
import { UpdateRoleDto } from '../../application/dtos/update-role.dto';
import { ListRolesQueryDto } from '../../application/dtos/list-roles-query.dto';
import { RolePresenter } from '../presenters/role.presenter';

@ApiTags('Roles y Permisos')
@ApiBearerAuth()
@Controller('roles')
export class RoleController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly getRoleUseCase: GetRoleUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_CREATE)
  @ApiOperation({ summary: 'Crear un rol con permisos' })
  @ApiResponse({ status: 201, description: 'Rol creado exitosamente.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRoleDto,
  ) {
    const role = await this.createRoleUseCase.execute(actor.id, dto);
    return RolePresenter.toResponse(role);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'Listar roles (filtrable por área)' })
  async findAll(@Query() query: ListRolesQueryDto) {
    const roles = await this.listRolesUseCase.execute({
      areaId: query.areaId,
      isActive: query.isActive,
    });
    return roles.map((role) => RolePresenter.toResponse(role));
  }

  @Get('permissions')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'Catálogo de permisos del sistema' })
  async findPermissions() {
    const permissions = await this.listPermissionsUseCase.execute();
    return permissions.map((p) => RolePresenter.permission(p));
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  @ApiOperation({ summary: 'Obtener un rol' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.getRoleUseCase.execute(id);
    return RolePresenter.toResponse(role);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ROLES_UPDATE)
  @ApiOperation({
    summary: 'Actualizar un rol (datos, área, estado o permisos)',
  })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const role = await this.updateRoleUseCase.execute(actor.id, id, dto);
    return RolePresenter.toResponse(role);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.ROLES_DELETE)
  @ApiOperation({ summary: 'Eliminar un rol (solo si no está asignado)' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteRoleUseCase.execute(actor.id, id);
  }
}
