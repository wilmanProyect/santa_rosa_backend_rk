import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';

export class ListAreasQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por áreas activas/inactivas' })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
