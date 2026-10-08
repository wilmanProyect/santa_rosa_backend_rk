import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    description:
      'Reemplaza la lista completa de roles del usuario (puede ser vacía)',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  roleIds: string[];
}
