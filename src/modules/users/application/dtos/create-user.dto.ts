import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

/** Número de CI con complemento opcional, p. ej. "1234567" o "1234567-1B". */
export const CI_NUMBER_PATTERN = /^\d{4,12}(-[0-9A-Za-z]{1,3})?$/;
export const PHONE_PATTERN = /^\+?[0-9\s-]{6,20}$/;

export class CreateUserDto {
  @ApiProperty({ example: 'Juan Carlos', description: 'Nombre(s)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  paternalLastName: string;

  @ApiPropertyOptional({
    example: 'Gómez',
    description: 'Opcional para personas con un solo apellido',
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  maternalLastName?: string;

  @ApiProperty({
    example: '1234567',
    description: 'Número de CI (admite complemento: 1234567-1B)',
  })
  @Matches(CI_NUMBER_PATTERN, {
    message: 'El número de CI no tiene un formato válido',
  })
  ciNumber: string;

  @ApiProperty({
    example: 'jperez',
    description: '3-30 caracteres: letras, números, ".", "-", "_"',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'juan.perez@example.com' })
  @IsEmail()
  @MaxLength(150)
  email: string;

  @ApiProperty({
    example: 'Temporal123',
    description:
      'Contraseña inicial (mín. 8, una mayúscula, una minúscula y un número). El usuario deberá cambiarla al ingresar.',
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: '1990-05-21', description: 'Formato YYYY-MM-DD' })
  @IsDateString({ strict: true })
  birthDate: string;

  @ApiPropertyOptional({ example: '+591 71234567' })
  @Matches(PHONE_PATTERN, { message: 'El teléfono no tiene un formato válido' })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'Asistente contable', description: 'Cargo' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  position?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsOptional()
  areaId?: string;

  @ApiPropertyOptional({ example: ['123e4567-e89b-12d3-a456-426614174000'] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  roleIds?: string[];
}
