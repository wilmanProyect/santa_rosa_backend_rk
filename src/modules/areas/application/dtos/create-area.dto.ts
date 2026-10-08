import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAreaDto {
  @ApiProperty({
    example: 'Contabilidad',
    description: 'Nombre único del área',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Área encargada de la contabilidad general' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;
}
