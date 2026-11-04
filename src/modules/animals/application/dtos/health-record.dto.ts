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
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import {
  AdministrationRoute,
  DoseUnit,
} from '@modules/veterinary/domain/enums/veterinary.enums';
import {
  HealthCategory,
  HealthEventType,
} from '../../domain/models/health-record.model';

const notNull = (_: object, value: unknown) => value !== null;
const DOSE = { maxDecimalPlaces: 2 };

const TYPE_DESCRIPTION =
  'Sanitario: VACCINATION, INTERNAL_DEWORMING, EXTERNAL_DEWORMING (baño), VITAMINS_MINERALS, TREATMENT, DIAGNOSIS. Manejo: SHEARING (esquila), HOOF_TRIMMING (pezuñas), OTHER_PROCEDURE. Instalaciones (sin animal): CORRAL_CLEANING.';

/** Campos comunes del evento (también para la aplicación masiva). */
class HealthRecordFieldsDto {
  @ApiProperty({ enum: HealthEventType, description: TYPE_DESCRIPTION })
  @IsEnum(HealthEventType)
  type: HealthEventType;

  @ApiProperty({ example: '2026-05-10' })
  @IsDateString({ strict: true })
  appliedAt: string;

  @ApiPropertyOptional({
    default: false,
    description: 'La fecha no es exacta (no se anotó)',
  })
  @IsBoolean()
  @IsOptional()
  isDateEstimated?: boolean;

  @ApiPropertyOptional({ description: 'Producto del catálogo veterinario' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ example: 'L-2291' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  productBatch?: string;

  @ApiPropertyOptional({ example: 6, description: 'Requiere doseUnit' })
  @IsNumber(DOSE)
  @Min(0.01)
  @Max(999999)
  @IsOptional()
  doseQuantity?: number;

  @ApiPropertyOptional({
    enum: DoseUnit,
    description: 'Si se omite, se usa la del producto',
  })
  @IsEnum(DoseUnit)
  @IsOptional()
  doseUnit?: DoseUnit;

  @ApiPropertyOptional({
    enum: AdministrationRoute,
    description: 'Si se omite, se usa la habitual del producto',
  })
  @IsEnum(AdministrationRoute)
  @IsOptional()
  route?: AdministrationRoute;

  @ApiPropertyOptional({
    example: 'Clostridiosis',
    description: 'Enfermedad que se previene o se trata',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  targetCondition?: string;

  @ApiPropertyOptional({ example: 'Dr. Orlando' })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  appliedBy?: string;

  @ApiPropertyOptional({ example: 'Corral 2' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    example: '2026-08-10',
    description: 'Próxima dosis o refuerzo: aparece en los recordatorios',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  nextDoseAt?: string;

  @ApiPropertyOptional({ example: 25.5 })
  @IsNumber(DOSE)
  @Min(0)
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

export class CreateHealthRecordDto extends HealthRecordFieldsDto {
  @ApiPropertyOptional({
    description:
      'Obligatorio, salvo en eventos de instalaciones (CORRAL_CLEANING)',
  })
  @IsUUID()
  @IsOptional()
  animalId?: string;
}

/** Solo cambian los campos enviados. null vacía los opcionales. El animal no se cambia. */
export class UpdateHealthRecordDto {
  @ApiPropertyOptional({ enum: HealthEventType })
  @IsEnum(HealthEventType)
  @IsOptional()
  type?: HealthEventType;

  @ApiPropertyOptional()
  @IsDateString({ strict: true })
  @IsOptional()
  appliedAt?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isDateEstimated?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsUUID()
  @IsOptional()
  productId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  productBatch?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsNumber(DOSE)
  @Min(0.01)
  @Max(999999)
  @IsOptional()
  doseQuantity?: number | null;

  @ApiPropertyOptional({ enum: DoseUnit, nullable: true })
  @ValidateIf(notNull)
  @IsEnum(DoseUnit)
  @IsOptional()
  doseUnit?: DoseUnit | null;

  @ApiPropertyOptional({ enum: AdministrationRoute, nullable: true })
  @ValidateIf(notNull)
  @IsEnum(AdministrationRoute)
  @IsOptional()
  route?: AdministrationRoute | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  targetCondition?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  appliedBy?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  location?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsDateString({ strict: true })
  @IsOptional()
  nextDoseAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsNumber(DOSE)
  @Min(0)
  @IsOptional()
  cost?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class BatchHealthItemDto {
  @ApiProperty()
  @IsUUID()
  animalId: string;

  @ApiPropertyOptional({
    description: 'Dosis de este animal, si difiere de la común',
  })
  @IsNumber(DOSE)
  @Min(0.01)
  @Max(999999)
  @IsOptional()
  doseQuantity?: number;

  @ApiPropertyOptional({ description: 'Observación de este animal' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

/** Aplicación masiva: mismo evento para varios animales (todo o nada). */
export class BatchHealthRecordDto extends HealthRecordFieldsDto {
  @ApiProperty({ type: [BatchHealthItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => BatchHealthItemDto)
  items: BatchHealthItemDto[];
}

export class ListHealthRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  animalId?: string;

  @ApiPropertyOptional({
    description: 'true: solo eventos generales (sin animal)',
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  general?: boolean;

  @ApiPropertyOptional({ enum: HealthEventType })
  @IsEnum(HealthEventType)
  @IsOptional()
  type?: HealthEventType;

  @ApiPropertyOptional({ enum: HealthCategory })
  @IsEnum(HealthCategory)
  @IsOptional()
  category?: HealthCategory;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Enfermedad / objetivo (búsqueda parcial)',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  targetCondition?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string;
}
