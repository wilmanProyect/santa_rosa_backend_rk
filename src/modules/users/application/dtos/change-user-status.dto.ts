import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  InactiveReason,
  UserStatus,
} from '../../domain/enums/user-status.enum';

export class ChangeUserStatusDto {
  @ApiProperty({ enum: UserStatus, example: UserStatus.INACTIVE })
  @IsEnum(UserStatus)
  status: UserStatus;

  @ApiPropertyOptional({
    enum: InactiveReason,
    example: InactiveReason.RESIGNATION,
    description:
      'Obligatorio al dar de baja. RESIGNATION=renuncia, DISMISSAL=despido, MEDICAL_LEAVE=baja médica, SUSPENSION=suspensión, OTHER=otro',
  })
  @ValidateIf((o: ChangeUserStatusDto) => o.status === UserStatus.INACTIVE)
  @IsEnum(InactiveReason)
  reason?: InactiveReason;

  @ApiPropertyOptional({
    example: '2026-10-07',
    description: 'Fecha de baja (por defecto, hoy)',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: 'Renuncia presentada el 30/09' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  notes?: string;
}
