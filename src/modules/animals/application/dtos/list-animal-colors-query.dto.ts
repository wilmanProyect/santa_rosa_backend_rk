import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';

export class ListAnimalColorsQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por colores activos/inactivos' })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
