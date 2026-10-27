import { ApiPropertyOptional } from '@nestjs/swagger';
import {
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
} from 'class-validator';
import {
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '../../domain/enums/animal.enums';
import {
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
  WEIGHT_RULES,
} from './create-animal.dto';

const notNull = (_: object, value: unknown) => value !== null;

/**
 * Solo se actualizan los campos enviados. Los anulables aceptan null para vaciarlos.
 * isExternal no se puede cambiar; el estado y el certificado tienen endpoints propios.
 */
export class UpdateAnimalDto {
  @ApiPropertyOptional({ example: 'SR-0154', nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(30)
  @IsOptional()
  earTag?: string | null;

  @ApiPropertyOptional({ example: 'Lucero', nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string | null;

  @ApiPropertyOptional({
    enum: Species,
    description: 'Si cambia, envíe también un breedId de la nueva especie',
  })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  breedId?: string;

  @ApiPropertyOptional({ enum: Sex })
  @IsEnum(Sex)
  @IsOptional()
  sex?: Sex;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsUUID()
  @IsOptional()
  colorId?: string | null;

  @ApiPropertyOptional({ enum: GeneticCategory, nullable: true })
  @ValidateIf(notNull)
  @IsEnum(GeneticCategory)
  @IsOptional()
  geneticCategory?: GeneticCategory | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  absidRegistry?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  absidCertificateCode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  externalRegistry?: string | null;

  @ApiPropertyOptional({
    description:
      'Caso especial (arete o ABSID repetido). En false se borra el motivo.',
  })
  @IsBoolean()
  @IsOptional()
  identifierException?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  identifierExceptionReason?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsUUID()
  @IsOptional()
  damId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsUUID()
  @IsOptional()
  sireId?: string | null;

  @ApiPropertyOptional({ example: '2025-08-14', nullable: true })
  @ValidateIf(notNull)
  @IsDateString({ strict: true })
  @IsOptional()
  birthDate?: string | null;

  @ApiPropertyOptional({ example: 4.35, nullable: true })
  @ValidateIf(notNull)
  @IsNumber(WEIGHT_RULES)
  @Min(MIN_WEIGHT_KG)
  @Max(MAX_WEIGHT_KG)
  @IsOptional()
  birthWeightKg?: number | null;

  @ApiPropertyOptional({ example: '2025-11-20', nullable: true })
  @ValidateIf(notNull)
  @IsDateString({ strict: true })
  @IsOptional()
  weaningDate?: string | null;

  @ApiPropertyOptional({ example: 22.5, nullable: true })
  @ValidateIf(notNull)
  @IsNumber(WEIGHT_RULES)
  @Min(MIN_WEIGHT_KG)
  @Max(MAX_WEIGHT_KG)
  @IsOptional()
  weaningWeightKg?: number | null;

  @ApiPropertyOptional({ enum: EntryOrigin })
  @IsEnum(EntryOrigin)
  @IsOptional()
  entryOrigin?: EntryOrigin;

  @ApiPropertyOptional({ example: '2026-03-02', nullable: true })
  @ValidateIf(notNull)
  @IsDateString({ strict: true })
  @IsOptional()
  entryDate?: string | null;

  @ApiPropertyOptional({ example: 'Cabaña San Isidro', nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  sourceFarm?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}
