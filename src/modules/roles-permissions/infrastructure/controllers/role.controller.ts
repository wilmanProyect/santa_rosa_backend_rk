import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateRoleUseCase } from '../../application/use-cases/create-role.use-case';
import { UpdateRoleUseCase } from '../../application/use-cases/update-role.use-case';
import { ListRolesUseCase } from '../../application/use-cases/list-roles.use-case';
import { ListPermissionsUseCase } from '../../application/use-cases/list-permissions.use-case';
import { CreateRoleDto } from '../../application/dtos/create-role.dto';
import { UpdateRoleDto } from '../../application/dtos/update-role.dto';

@ApiTags('Roles y Permisos')
@Controller('roles')
export class RoleController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly listRolesUseCase: ListRolesUseCase,
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo rol con permisos' })
  @ApiResponse({ status: 201, description: 'Rol creado exitosamente.' })
  async create(@Body() createRoleDto: CreateRoleDto) {
    const role = await this.createRoleUseCase.execute(createRoleDto);
    return {
      id: role.getId(),
      name: role.getName(),
      description: role.getDescription(),
      permissions: role.getPermissions().map(p => ({
        id: p.getId(),
        name: p.getName(),
        description: p.getDescription(),
      })),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los roles' })
  @ApiResponse({ status: 200, description: 'Lista de roles obtenida.' })
  async findAll() {
    const roles = await this.listRolesUseCase.execute();
    return roles.map(role => ({
      id: role.getId(),
      name: role.getName(),
      description: role.getDescription(),
      permissions: role.getPermissions().map(p => ({
        id: p.getId(),
        name: p.getName(),
        description: p.getDescription(),
      })),
    }));
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Obtener todos los permisos disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de permisos obtenida.' })
  async findPermissions() {
    const permissions = await this.listPermissionsUseCase.execute();
    return permissions.map(p => ({
      id: p.getId(),
      name: p.getName(),
      description: p.getDescription(),
    }));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un rol existente' })
  @ApiResponse({ status: 200, description: 'Rol actualizado exitosamente.' })
  async update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    const role = await this.updateRoleUseCase.execute(id, updateRoleDto);
    return {
      id: role.getId(),
      name: role.getName(),
      description: role.getDescription(),
      permissions: role.getPermissions().map(p => ({
        id: p.getId(),
        name: p.getName(),
        description: p.getDescription(),
      })),
    };
  }
}
