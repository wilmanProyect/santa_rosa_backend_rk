import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';
import { AssignRolesUseCase } from '../../application/use-cases/assign-roles.use-case';
import { CreateUserDto } from '../../application/dtos/create-user.dto';
import { AssignRolesDto } from '../../application/dtos/assign-roles.dto';

@ApiTags('Usuarios')
@Controller('users')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly assignRolesUseCase: AssignRolesUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario con roles opcionales' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente.' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.createUserUseCase.execute(createUserDto);
    return {
      id: user.getId(),
      name: user.getName(),
      email: user.getEmail().getValue(),
      isActive: user.getIsActive(),
      roles: user.getRoles().map(r => ({
        id: r.getId(),
        name: r.getName(),
      })),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios obtenida.' })
  async findAll() {
    const users = await this.listUsersUseCase.execute();
    return users.map(user => ({
      id: user.getId(),
      name: user.getName(),
      email: user.getEmail().getValue(),
      isActive: user.getIsActive(),
      roles: user.getRoles().map(r => ({
        id: r.getId(),
        name: r.getName(),
        permissions: r.getPermissions().map(p => p.getName()),
      })),
    }));
  }

  @Put(':id/roles')
  @ApiOperation({ summary: 'Asignar o actualizar los roles de un usuario' })
  @ApiResponse({ status: 200, description: 'Roles asignados exitosamente.' })
  async assignRoles(@Param('id') id: string, @Body() assignRolesDto: AssignRolesDto) {
    const user = await this.assignRolesUseCase.execute(id, assignRolesDto);
    return {
      id: user.getId(),
      name: user.getName(),
      email: user.getEmail().getValue(),
      isActive: user.getIsActive(),
      roles: user.getRoles().map(r => ({
        id: r.getId(),
        name: r.getName(),
      })),
    };
  }
}
