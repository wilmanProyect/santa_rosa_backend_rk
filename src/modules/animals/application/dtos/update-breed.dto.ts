import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Species } from '../../domain/enums/animal.enums';

export class UpdateBreedDto {
  @ApiPropertyOptional({
    enum: Species,
    description: 'Solo si ningún animal tiene esta raza',
  })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({ example: 'Merino Australiano' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
