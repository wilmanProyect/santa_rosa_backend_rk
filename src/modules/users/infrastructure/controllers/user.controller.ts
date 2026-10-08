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
  Put,
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
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from '../../application/use-cases/update-user.use-case';
import { GetUserUseCase } from '../../application/use-cases/get-user.use-case';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import { ChangeUserStatusUseCase } from '../../application/use-cases/change-user-status.use-case';
import { AssignRolesUseCase } from '../../application/use-cases/assign-roles.use-case';
import { AssignPermissionsUseCase } from '../../application/use-cases/assign-permissions.use-case';
import { ResetUserPasswordUseCase } from '../../application/use-cases/reset-user-password.use-case';
import { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';
import { CreateUserDto } from '../../application/dtos/create-user.dto';
import { UpdateUserDto } from '../../application/dtos/update-user.dto';
import { ListUsersQueryDto } from '../../application/dtos/list-users-query.dto';
import { ChangeUserStatusDto } from '../../application/dtos/change-user-status.dto';
import { AssignRolesDto } from '../../application/dtos/assign-roles.dto';
import { AssignPermissionsDto } from '../../application/dtos/assign-permissions.dto';
import { ResetPasswordDto } from '../../application/dtos/reset-password.dto';
import { UserPresenter } from '../presenters/user.presenter';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly changeUserStatusUseCase: ChangeUserStatusUseCase,
    private readonly assignRolesUseCase: AssignRolesUseCase,
    private readonly assignPermissionsUseCase: AssignPermissionsUseCase,
    private readonly resetUserPasswordUseCase: ResetUserPasswordUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  @ApiOperation({
    summary: 'Crear un usuario (deberá cambiar su contraseña al ingresar)',
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente.' })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ) {
    const user = await this.createUserUseCase.execute(actor.id, dto);
    return UserPresenter.toResponse(user);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({
    summary: 'Listar usuarios (paginado, con búsqueda y filtros)',
  })
  async findAll(@Query() query: ListUsersQueryDto) {
    const result = await this.listUsersUseCase.execute(
      { search: query.search, status: query.status, areaId: query.areaId },
      { page: query.page, limit: query.limit },
    );
    return {
      ...result,
      items: result.items.map((u) => UserPresenter.toSummary(u)),
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({
    summary: 'Obtener un usuario con sus roles y permisos efectivos',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.getUserUseCase.execute(id);
    return UserPresenter.toResponse(user);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  @ApiOperation({ summary: 'Actualizar los datos de un usuario' })
  async update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.updateUserUseCase.execute(actor.id, id, dto);
    return UserPresenter.toResponse(user);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USERS_CHANGE_STATUS)
  @ApiOperation({ summary: 'Activar o dar de baja a un usuario (con motivo)' })
  async changeStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
  ) {
    const user = await this.changeUserStatusUseCase.execute(actor.id, id, dto);
    return UserPresenter.toResponse(user);
  }

  @Put(':id/roles')
  @RequirePermissions(PERMISSIONS.USERS_ASSIGN_ROLES)
  @ApiOperation({ summary: 'Reemplazar los roles de un usuario' })
  async assignRoles(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRolesDto,
  ) {
    const user = await this.assignRolesUseCase.execute(actor.id, id, dto);
    return UserPresenter.toResponse(user);
  }

  @Put(':id/permissions')
  @RequirePermissions(PERMISSIONS.USERS_ASSIGN_PERMISSIONS)
  @ApiOperation({
    summary:
      'Reemplazar los permisos individuales (otorgados/denegados) de un usuario',
  })
  async assignPermissions(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    const user = await this.assignPermissionsUseCase.execute(actor.id, id, dto);
    return UserPresenter.toResponse(user);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.USERS_RESET_PASSWORD)
  @ApiOperation({
    summary: 'Restablecer la contraseña de un usuario (cierra sus sesiones)',
  })
  async resetPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.resetUserPasswordUseCase.execute(actor.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @ApiOperation({ summary: 'Eliminar un usuario (borrado lógico)' })
  async remove(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.deleteUserUseCase.execute(actor.id, id);
  }
}
