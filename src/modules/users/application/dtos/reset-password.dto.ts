import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'Temporal123',
    description:
      'Nueva contraseña temporal. El usuario deberá cambiarla al ingresar.',
  })
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
