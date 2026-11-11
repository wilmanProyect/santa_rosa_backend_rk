import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';
import { Species } from '@modules/animals/domain/enums/animal.enums';
import {
  MAX_LITTER_SIZE,
  PregnancyCheckMethod,
  PregnancyCheckResult,
  ServiceStatus,
  ServiceType,
} from '../../domain/enums/reproduction.enums';

const notNull = (_: object, value: unknown) => value !== null;

const TYPE_DESCRIPTION =
  'DIRECTED=monta dirigida (macho propio o externo), ARTIFICIAL_INSEMINATION=inseminación artificial (el padre debe ser un reproductor externo)';

export class BreedingCheckDto {
  @ApiProperty({ description: 'Hembra' })
  @IsUUID()
  damId: string;

  @ApiProperty({ description: 'Macho (propio o externo)' })
  @IsUUID()
  sireId: string;

  @ApiPropertyOptional({
    enum: ServiceType,
    default: ServiceType.DIRECTED,
    description: TYPE_DESCRIPTION,
  })
  @IsEnum(ServiceType)
  @IsOptional()
  type?: ServiceType;

  @ApiPropertyOptional({
    example: '2026-11-11',
    description: 'Fecha de la monta (por defecto, hoy)',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  serviceDate?: string;
}

export class CreateBreedingServiceDto {
  @ApiProperty({ description: 'Hembra de la cabaña' })
  @IsUUID()
  damId: string;

  @ApiProperty({ description: 'Macho (propio o externo)' })
  @IsUUID()
  sireId: string;

  @ApiProperty({ enum: ServiceType, description: TYPE_DESCRIPTION })
  @IsEnum(ServiceType)
  type: ServiceType;

  @ApiProperty({ example: '2026-11-11' })
  @IsDateString({ strict: true })
  serviceDate: string;

  @ApiPropertyOptional({
    example: 'PAJ-2026-018',
    description: 'Código de la pajuela (solo inseminación artificial)',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  strawCode?: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Quién hizo la monta o la inseminación',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  performedBy?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Registrar la monta aunque la pareja esté emparentada. Requiere el permiso reproduction:override-kinship y overrideReason.',
  })
  @IsBoolean()
  @IsOptional()
  overrideKinship?: boolean;

  @ApiPropertyOptional({
    example: 'Línea de alto valor genético, sin otro macho PO disponible',
    description: 'Justificación obligatoria si overrideKinship es true',
  })
  @ValidateIf((o: CreateBreedingServiceDto) => o.overrideKinship === true)
  @IsString()
  @MinLength(10, {
    message: 'La justificación debe tener al menos 10 caracteres',
  })
  @MaxLength(500)
  overrideReason?: string;
}

/** La pareja y el tipo no cambian: si están mal, se elimina la monta y se registra otra. */
export class UpdateBreedingServiceDto {
  @ApiPropertyOptional({ example: '2026-11-10' })
  @IsDateString({ strict: true })
  @IsOptional()
  serviceDate?: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  strawCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  performedBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class ListBreedingServicesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ServiceStatus })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @ApiPropertyOptional({ enum: ServiceType })
  @IsEnum(ServiceType)
  @IsOptional()
  type?: ServiceType;

  @ApiPropertyOptional({ enum: Species })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({ description: 'Montas en las que es madre o padre' })
  @IsUUID()
  @IsOptional()
  animalId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  damId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sireId?: string;

  @ApiPropertyOptional({ description: 'Fecha de monta desde (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha de monta hasta (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'true: solo las autorizadas pese al parentesco',
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  kinshipOverride?: boolean;
}

export class CreatePregnancyCheckDto {
  @ApiProperty({ example: '2026-12-20' })
  @IsDateString({ strict: true })
  checkedAt: string;

  @ApiProperty({
    enum: PregnancyCheckMethod,
    description: 'ULTRASOUND=ecografía, OBSERVATION=observación',
  })
  @IsEnum(PregnancyCheckMethod)
  method: PregnancyCheckMethod;

  @ApiProperty({
    enum: PregnancyCheckResult,
    description: 'PREGNANT=preñada, EMPTY=vacía',
  })
  @IsEnum(PregnancyCheckResult)
  result: PregnancyCheckResult;

  @ApiPropertyOptional({
    example: 2,
    description: `Fetos vistos en la ecografía (1 a ${MAX_LITTER_SIZE}), solo si está preñada`,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LITTER_SIZE)
  @IsOptional()
  fetusCount?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}

export class RecordAbortionDto {
  @ApiProperty({ example: '2027-01-15' })
  @IsDateString({ strict: true })
  date: string;

  @ApiPropertyOptional({ example: 'Probable toxoplasmosis' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  cause?: string;
}
