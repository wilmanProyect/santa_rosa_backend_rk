import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';
import { Species } from '../../domain/enums/animal.enums';

export class ListBreedsQueryDto {
  @ApiPropertyOptional({ enum: Species })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({ description: 'Filtrar por razas activas/inactivas' })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
