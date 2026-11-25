import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import { AuditEventType } from '@shared/application/ports/audit-events.interface';
import {
  AUDIT_ENTITY_LABELS,
  AuditAction,
  AuditSource,
} from '../domain/audit.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class AnimalActivityQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AuditAction })
  @IsEnum(AuditAction)
  @IsOptional()
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Desde (YYYY-MM-DD, incluido)' })
  @Matches(DATE_RE, { message: 'from debe tener el formato YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD, incluido)' })
  @Matches(DATE_RE, { message: 'to debe tener el formato YYYY-MM-DD' })
  @IsOptional()
  to?: string;
}

export class ActivityQueryDto extends AnimalActivityQueryDto {
  @ApiPropertyOptional({ description: 'Usuario que hizo el cambio' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    enum: Object.keys(AUDIT_ENTITY_LABELS),
    description: 'Tabla (ver GET /audit/entities)',
  })
  @IsIn(Object.keys(AUDIT_ENTITY_LABELS))
  @IsOptional()
  entity?: string;

  @ApiPropertyOptional({
    description: 'Id del registro (usar junto con entity)',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  recordId?: string;

  @ApiPropertyOptional({ description: 'Cambios relacionados con este animal' })
  @IsUUID()
  @IsOptional()
  animalId?: string;

  @ApiPropertyOptional({ enum: AuditEventType })
  @IsEnum(AuditEventType)
  @IsOptional()
  event?: AuditEventType;

  @ApiPropertyOptional({ enum: AuditSource })
  @IsEnum(AuditSource)
  @IsOptional()
  source?: AuditSource;

  @ApiPropertyOptional({
    description: 'Todos los cambios de una misma operación',
  })
  @IsUUID()
  @IsOptional()
  requestId?: string;
}
