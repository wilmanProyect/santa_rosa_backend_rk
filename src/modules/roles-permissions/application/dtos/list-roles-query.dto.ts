import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';

export class ListRolesQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar roles de un área' })
  @IsUUID()
  @IsOptional()
  areaId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por roles activos/inactivos' })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
