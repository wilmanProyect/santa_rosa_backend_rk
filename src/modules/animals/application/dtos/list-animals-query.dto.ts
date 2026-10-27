import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';
import {
  AnimalStatus,
  GeneticCategory,
  Sex,
  Species,
} from '../../domain/enums/animal.enums';

export class ListAnimalsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Busca en arete, nombre, registro ABSID y registro externo',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'false: animales de la cabaña. true: animales externos.',
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isExternal?: boolean;

  @ApiPropertyOptional({ enum: Species })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({ enum: Sex })
  @IsEnum(Sex)
  @IsOptional()
  sex?: Sex;

  @ApiPropertyOptional({
    enum: AnimalStatus,
    description: 'ALIVE = inventario actual',
  })
  @IsEnum(AnimalStatus)
  @IsOptional()
  status?: AnimalStatus;

  @ApiPropertyOptional({ enum: GeneticCategory })
  @IsEnum(GeneticCategory)
  @IsOptional()
  geneticCategory?: GeneticCategory;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  breedId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  colorId?: string;

  @ApiPropertyOptional({
    description: 'Crías de este animal (como madre o padre)',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({
    description: 'true: solo los casos especiales (arete o ABSID repetido)',
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  identifierException?: boolean;
}
