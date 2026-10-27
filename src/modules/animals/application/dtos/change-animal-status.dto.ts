import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AnimalStatus } from '../../domain/enums/animal.enums';

export class ChangeAnimalStatusDto {
  @ApiProperty({
    enum: AnimalStatus,
    example: AnimalStatus.SOLD,
    description:
      'ALIVE=vivo, DEAD=muerto, SOLD=vendido, SLAUGHTERED=faenado, GIFTED=regalado. Volver a ALIVE borra la fecha y el motivo.',
  })
  @IsEnum(AnimalStatus)
  status: AnimalStatus;

  @ApiPropertyOptional({
    example: '2026-10-20',
    description: 'Obligatoria si el estado no es ALIVE',
  })
  @ValidateIf((o: ChangeAnimalStatusDto) => o.status !== AnimalStatus.ALIVE)
  @IsDateString({ strict: true })
  date?: string;

  @ApiPropertyOptional({
    example: 'Vendido a Cabaña El Porvenir',
    description: 'Motivo o detalle (causa de muerte, comprador, etc.)',
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
