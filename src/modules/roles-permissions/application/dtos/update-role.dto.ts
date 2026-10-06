import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength, IsUUID } from 'class-validator';

export class UpdateRoleDto {
  @ApiProperty({ example: 'Administrador Modificado', description: 'Nombre único del rol' })
  @IsString()
  @IsOptional()
  @MinLength(3)
  name?: string;

  @ApiProperty({ example: 'Acceso total y auditoría', description: 'Descripción de las responsabilidades del rol' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['123e4567-e89b-12d3-a456-426614174000'], description: 'Lista de IDs de permisos asignados' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  permissionIds?: string[];
}
