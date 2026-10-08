import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'Admin123' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword: string;

  @ApiProperty({
    example: 'NuevaClave2026',
    description:
      'Mín. 8 caracteres, con al menos una mayúscula, una minúscula y un número',
  })
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
