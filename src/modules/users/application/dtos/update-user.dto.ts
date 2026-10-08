import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CI_NUMBER_PATTERN, PHONE_PATTERN } from './create-user.dto';

/** Solo se actualizan los campos enviados. Los campos opcionales aceptan null para vaciarlos. */
export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Juan Carlos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  paternalLastName?: string;

  @ApiPropertyOptional({ example: 'Gómez', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  maternalLastName?: string | null;

  @ApiPropertyOptional({ example: '1234567' })
  @Matches(CI_NUMBER_PATTERN, {
    message: 'El número de CI no tiene un formato válido',
  })
  @IsOptional()
  ciNumber?: string;

  @ApiPropertyOptional({ example: 'jperez' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'juan.perez@example.com' })
  @IsEmail()
  @MaxLength(150)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '1990-05-21' })
  @IsDateString({ strict: true })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({ example: '+591 71234567', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @Matches(PHONE_PATTERN, { message: 'El teléfono no tiene un formato válido' })
  @IsOptional()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Contador', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  position?: string | null;

  @ApiPropertyOptional({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  areaId?: string | null;
}
