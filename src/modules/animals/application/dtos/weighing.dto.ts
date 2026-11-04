import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  MAX_WEIGHT_KG,
  WeighingType,
} from '../../domain/models/animal-weighing.model';

const KG = { maxDecimalPlaces: 2 };
const SCORE = { maxDecimalPlaces: 1 };
const notNull = (_: object, value: unknown) => value !== null;

const WEIGHING_TYPE_DESCRIPTION =
  'BIRTH=nacimiento, WEANING=destete, ROUTINE=control periódico, SELECTION=selección, ENTRY=ingreso (compra), SALE=venta, OTHER=otro. BIRTH y WEANING solo una vez por animal.';

export class CreateWeighingDto {
  @ApiProperty({ example: '2025-02-11', description: 'Fecha del pesaje' })
  @IsDateString({ strict: true })
  weighedAt: string;

  @ApiProperty({ example: 18.7, description: 'kg, hasta 2 decimales' })
  @IsNumber(KG)
  @Min(0.01)
  @Max(MAX_WEIGHT_KG)
  weightKg: number;

  @ApiProperty({ enum: WeighingType, description: WEIGHING_TYPE_DESCRIPTION })
  @IsEnum(WeighingType)
  type: WeighingType;

  @ApiPropertyOptional({
    example: 3.5,
    description: 'Condición corporal 1 a 5 (pasos de 0,5)',
  })
  @IsNumber(SCORE)
  @Min(1)
  @Max(5)
  @IsOptional()
  bodyConditionScore?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Peso aproximado, sin balanza',
  })
  @IsBoolean()
  @IsOptional()
  isEstimated?: boolean;

  @ApiPropertyOptional({
    example: '2025-05-11',
    description: 'Próximo pesaje programado: aparece en los recordatorios',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  nextWeighingAt?: string;

  @ApiPropertyOptional({ example: 'Destete' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

/** Solo cambian los campos enviados. null vacía los opcionales. */
export class UpdateWeighingDto {
  @ApiPropertyOptional()
  @IsDateString({ strict: true })
  @IsOptional()
  weighedAt?: string;

  @ApiPropertyOptional()
  @IsNumber(KG)
  @Min(0.01)
  @Max(MAX_WEIGHT_KG)
  @IsOptional()
  weightKg?: number;

  @ApiPropertyOptional({ enum: WeighingType })
  @IsEnum(WeighingType)
  @IsOptional()
  type?: WeighingType;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsNumber(SCORE)
  @Min(1)
  @Max(5)
  @IsOptional()
  bodyConditionScore?: number | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isEstimated?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsDateString({ strict: true })
  @IsOptional()
  nextWeighingAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class BatchWeighingItemDto {
  @ApiProperty()
  @IsUUID()
  animalId: string;

  @ApiProperty({ example: 18.7 })
  @IsNumber(KG)
  @Min(0.01)
  @Max(MAX_WEIGHT_KG)
  weightKg: number;

  @ApiPropertyOptional()
  @IsNumber(SCORE)
  @Min(1)
  @Max(5)
  @IsOptional()
  bodyConditionScore?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isEstimated?: boolean;

  @ApiPropertyOptional({ description: 'Observación de este animal' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

/** Jornada de pesaje: misma fecha y motivo para todos los animales. */
export class BatchWeighingDto {
  @ApiProperty({ example: '2025-02-11' })
  @IsDateString({ strict: true })
  weighedAt: string;

  @ApiProperty({ enum: WeighingType, description: WEIGHING_TYPE_DESCRIPTION })
  @IsEnum(WeighingType)
  type: WeighingType;

  @ApiPropertyOptional({ description: 'Próximo pesaje para todos' })
  @IsDateString({ strict: true })
  @IsOptional()
  nextWeighingAt?: string;

  @ApiPropertyOptional({
    description: 'Observación común (se suma a la de cada animal)',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [BatchWeighingItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchWeighingItemDto)
  items: BatchWeighingItemDto[];
}

export class PendingQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-09',
    description:
      'Incluye lo programado hasta esta fecha (por defecto, dentro de 7 días)',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  until?: string;
}
