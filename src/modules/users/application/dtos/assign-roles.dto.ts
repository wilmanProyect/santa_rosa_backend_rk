import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({ example: ['123e4567-e89b-12d3-a456-426614174000'], description: 'Lista de IDs de roles a asignar al usuario' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsNotEmpty()
  roleIds: string[];
}
