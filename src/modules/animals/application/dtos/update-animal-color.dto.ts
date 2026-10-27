import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateAnimalColorDto {
  @ApiPropertyOptional({ example: 'Blanco crema' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
