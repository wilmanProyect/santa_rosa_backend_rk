import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, MinLength, IsUUID } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({ example: 'Administrador', description: 'Nombre único del rol' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'Acceso total al sistema', description: 'Descripción de las responsabilidades del rol' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: ['123e4567-e89b-12d3-a456-426614174000'], description: 'Lista de IDs de permisos asignados' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  permissionIds?: string[];
}
