import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '../../domain/enums/animal.enums';

export class CreateAnimalDto {
  @ApiPropertyOptional({
    default: false,
    description:
      'true para registrar un animal ajeno a la cabaña (p. ej. donante de semen), solo para la genealogía',
  })
  @IsBoolean()
  @IsOptional()
  isExternal?: boolean;

  @ApiPropertyOptional({
    example: 'SR-0154',
    description:
      'Arete. Obligatorio en animales de la cabaña, salvo como caso especial (identifierException) si no tiene arete registrado.',
  })
  @IsString()
  @MaxLength(30)
  @IsOptional()
  earTag?: string;

  @ApiPropertyOptional({ example: 'Lucero' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiProperty({ enum: Species, example: Species.SHEEP })
  @IsEnum(Species)
  species: Species;

  @ApiProperty({ description: 'Raza activa de la misma especie' })
  @IsUUID()
  breedId: string;

  @ApiProperty({ enum: Sex, example: Sex.FEMALE })
  @IsEnum(Sex)
  sex: Sex;

  @ApiPropertyOptional({ description: 'Color activo del catálogo' })
  @IsUUID()
  @IsOptional()
  colorId?: string;

  @ApiPropertyOptional({
    enum: GeneticCategory,
    description: 'Opcional: se puede completar después',
  })
  @IsEnum(GeneticCategory)
  @IsOptional()
  geneticCategory?: GeneticCategory;

  @ApiPropertyOptional({ example: 'ABSID-2024-0153' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  absidRegistry?: string;

  @ApiPropertyOptional({ example: 'CERT-88412' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  absidCertificateCode?: string;

  @ApiPropertyOptional({
    example: 'AUS-MER-55120',
    description:
      'Registro en otra entidad o código del reproductor en el centro de semen',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  externalRegistry?: string;

  @ApiPropertyOptional({
    default: false,
    description:
      'Caso especial: permite registrar un arete o registro ABSID que ya tiene otro animal. Requiere identifierExceptionReason.',
  })
  @IsBoolean()
  @IsOptional()
  identifierException?: boolean;

  @ApiPropertyOptional({
    example:
      'Registrado así en la planilla de la cabaña; por política no se cambia',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  identifierExceptionReason?: string;

  @ApiPropertyOptional({ description: 'Madre: hembra de la misma especie' })
  @IsUUID()
  @IsOptional()
  damId?: string;

  @ApiPropertyOptional({ description: 'Padre: macho de la misma especie' })
  @IsUUID()
  @IsOptional()
  sireId?: string;

  @ApiPropertyOptional({
    example: '2025-08-14',
    description: 'Obligatoria si el animal nació en la cabaña',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  birthDate?: string;

  @ApiPropertyOptional({
    enum: EntryOrigin,
    default: EntryOrigin.BORN_ON_FARM,
    description:
      'BORN_ON_FARM=nacido en la cabaña, PURCHASE=compra, DONATION=donación, GIFT=regalo, INITIAL_STOCK=inventario inicial (ya estaba en la cabaña, origen desconocido). No aplica a animales externos.',
  })
  @IsEnum(EntryOrigin)
  @IsOptional()
  entryOrigin?: EntryOrigin;

  @ApiPropertyOptional({
    example: '2026-03-02',
    description:
      'Fecha de ingreso a la cabaña, si se conoce. No se envía si nació en la cabaña.',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  entryDate?: string;

  @ApiPropertyOptional({
    example: 'Cabaña San Isidro',
    description: 'Cabaña de procedencia (o centro de semen)',
  })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  sourceFarm?: string;

  @ApiPropertyOptional({ example: 'Comprado con su cría al pie' })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}
