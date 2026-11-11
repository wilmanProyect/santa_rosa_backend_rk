import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { GeneticCategory } from '../../domain/enums/animal.enums';

export class ConfirmGeneticCategoryDto {
  @ApiPropertyOptional({
    enum: GeneticCategory,
    description:
      'Categoría que asignó ABSID. Si se omite, se confirma la categoría esperada actual.',
  })
  @IsEnum(GeneticCategory)
  @IsOptional()
  category?: GeneticCategory;

  @ApiPropertyOptional({
    example: '2026-11-11',
    description: 'Fecha de la confirmación (por defecto, hoy)',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  confirmedOn?: string;

  @ApiPropertyOptional({
    example: 'CERT-2026-0145',
    description:
      'Código del certificado ABSID. También se guarda en el animal (absidCertificateCode).',
  })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  absidCertificateCode?: string;

  @ApiPropertyOptional({ example: 'Inspección de noviembre' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}
