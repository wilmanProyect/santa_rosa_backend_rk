import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
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
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';
import { Sex, Species } from '@modules/animals/domain/enums/animal.enums';
import { MAX_WEIGHT_KG } from '@modules/animals/domain/models/animal-weighing.model';
import {
  BirthAssistance,
  MAX_LITTER_SIZE,
} from '../../domain/enums/reproduction.enums';

const notNull = (_: object, value: unknown) => value !== null;

export class BirthOffspringDto {
  @ApiProperty({
    description:
      'false: nacida muerta. Solo cuenta para los indicadores (no se crea el animal).',
  })
  @IsBoolean()
  bornAlive: boolean;

  @ApiPropertyOptional({
    enum: Sex,
    description: 'Obligatorio en las crías vivas',
  })
  @ValidateIf((o: BirthOffspringDto) => o.bornAlive || o.sex !== undefined)
  @IsEnum(Sex)
  sex?: Sex;

  @ApiPropertyOptional({
    example: 3.8,
    description: 'kg. En las vivas se registra como pesaje de nacimiento.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_WEIGHT_KG)
  @IsOptional()
  birthWeightKg?: number;

  @ApiPropertyOptional({
    example: '00412',
    description: 'Arete de la cría viva (obligatorio en las vivas)',
  })
  @ValidateIf((o: BirthOffspringDto) => o.bornAlive)
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  earTag?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Raza de la cría. Por defecto, la de la madre.',
  })
  @IsUUID()
  @IsOptional()
  breedId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  colorId?: string;

  @ApiPropertyOptional({ description: 'Observaciones de la cría' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}

export class RegisterBirthDto {
  @ApiProperty({ example: '2027-04-07' })
  @IsDateString({ strict: true })
  birthDate: string;

  @ApiPropertyOptional({
    enum: BirthAssistance,
    description: 'NORMAL, ASSISTED=asistido, CESAREAN=cesárea',
  })
  @IsEnum(BirthAssistance)
  @IsOptional()
  assistance?: BirthAssistance;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;

  @ApiProperty({
    type: [BirthOffspringDto],
    description: `Una fila por cría, en orden de nacimiento (1 a ${MAX_LITTER_SIZE}). 2 = gemelos, 3 = trillizos.`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_LITTER_SIZE)
  @ValidateNested({ each: true })
  @Type(() => BirthOffspringDto)
  offspring: BirthOffspringDto[];
}

/** Parto sin monta registrada (p. ej. una monta que no se anotó). */
export class RegisterUnplannedBirthDto extends RegisterBirthDto {
  @ApiProperty()
  @IsUUID()
  damId: string;

  @ApiPropertyOptional({ description: 'Omitir si no se conoce el padre' })
  @IsUUID()
  @IsOptional()
  sireId?: string;
}

export class UpdateBirthDto {
  @ApiPropertyOptional({ enum: BirthAssistance, nullable: true })
  @ValidateIf(notNull)
  @IsEnum(BirthAssistance)
  @IsOptional()
  assistance?: BirthAssistance | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;
}

export class ListBirthsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: Species })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({
    description: 'Partos en los que el animal es madre, padre o cría',
  })
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

  @ApiPropertyOptional({ description: 'Desde (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    description: 'Número de crías: 1 simple, 2 gemelos, 3 trillizos',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LITTER_SIZE)
  @IsOptional()
  litterSize?: number;

  @ApiPropertyOptional({
    description: 'true: solo los reconstruidos de los datos anteriores',
  })
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isHistorical?: boolean;
}

export class ReproductionStatsQueryDto {
  @ApiPropertyOptional({ enum: Species })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({ description: 'Desde (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD)' })
  @IsDateString({ strict: true })
  @IsOptional()
  to?: string;
}
