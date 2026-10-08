import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';

export class LoginHistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por usuario' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: 'true = solo exitosos, false = solo fallidos',
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  success?: boolean;
}
