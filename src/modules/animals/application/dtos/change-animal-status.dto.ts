import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
      'ALIVE=vivo, DEAD=muerto, SOLD=vendido, SLAUGHTERED=faenado, GIFTED=regalado, EXCHANGED=intercambiado, LOST=perdido. Volver a ALIVE borra la fecha y el motivo.',
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

  @ApiPropertyOptional({
    default: false,
    description:
      'Faenar aunque el animal esté en período de retiro. Requiere el permiso health:override-withdrawal y overrideReason.',
  })
  @IsBoolean()
  @IsOptional()
  overrideWithdrawal?: boolean;

  @ApiPropertyOptional({
    example: 'Consumo interno autorizado por el veterinario',
    description: 'Obligatorio si overrideWithdrawal es true',
  })
  @ValidateIf((o: ChangeAnimalStatusDto) => o.overrideWithdrawal === true)
  @IsString()
  @MaxLength(300)
  overrideReason?: string;
}
