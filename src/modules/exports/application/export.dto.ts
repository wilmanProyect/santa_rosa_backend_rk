import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsBoolean,
  IsEnum,
  IsOptional,
  Matches,
} from 'class-validator';
import {
  AnimalStatus,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import { ExportSection } from '../domain/export.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class ExportQueryDto {
  @ApiPropertyOptional({
    description:
      'Secciones separadas por coma: animals, health, services, births. Por defecto, todas las que el usuario puede ver.',
    example: 'animals,health',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsEnum(ExportSection, {
    each: true,
    message: 'sections admite: animals, health, services, births',
  })
  @ArrayUnique()
  @IsOptional()
  sections?: ExportSection[];

  @ApiPropertyOptional({ enum: Species })
  @IsEnum(Species)
  @IsOptional()
  species?: Species;

  @ApiPropertyOptional({
    description:
      'Desde (YYYY-MM-DD, incluido). Filtra sanidad, montas, diagnósticos y partos; no la hoja de animales.',
  })
  @Matches(DATE_RE, { message: 'from debe tener el formato YYYY-MM-DD' })
  @IsOptional()
  from?: string;

  @ApiPropertyOptional({ description: 'Hasta (YYYY-MM-DD, incluido)' })
  @Matches(DATE_RE, { message: 'to debe tener el formato YYYY-MM-DD' })
  @IsOptional()
  to?: string;

  @ApiPropertyOptional({
    enum: AnimalStatus,
    description: 'Solo la hoja de animales. ALIVE: el inventario actual.',
  })
  @IsEnum(AnimalStatus)
  @IsOptional()
  status?: AnimalStatus;

  @ApiPropertyOptional({
    description:
      'Solo la hoja de animales: incluir los reproductores externos (por defecto no)',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @IsOptional()
  includeExternal?: boolean;
}
