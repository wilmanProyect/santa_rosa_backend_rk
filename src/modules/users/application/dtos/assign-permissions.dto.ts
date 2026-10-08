import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

/** Reemplaza todos los ajustes individuales de permisos del usuario. */
export class AssignPermissionsDto {
  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    description: 'Permisos otorgados al usuario además de los de sus roles',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  grantedPermissionIds: string[];

  @ApiProperty({
    example: [],
    description: 'Permisos quitados al usuario aunque sus roles los tengan',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  deniedPermissionIds: string[];
}
