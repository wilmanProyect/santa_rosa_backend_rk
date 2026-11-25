import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import { ControlType } from '../domain/notification.enums';
import { SETTINGS_LIMITS } from '../domain/notification-rules';

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

export class ListNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ default: false, description: 'Solo las no leídas' })
  @Transform(toBoolean)
  @IsBoolean()
  @IsOptional()
  unreadOnly?: boolean;
}

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Clave pública del navegador (base64url)' })
  @IsString()
  @MaxLength(100)
  p256dh: string;

  @ApiProperty({ description: 'Secreto de autenticación (base64url)' })
  @IsString()
  @MaxLength(50)
  auth: string;
}

/** Lo que devuelve `PushSubscription.toJSON()` en el navegador. */
export class PushSubscriptionDto {
  @ApiProperty({ example: 'https://fcm.googleapis.com/fcm/send/...' })
  @IsString()
  @MaxLength(1000)
  endpoint: string;

  @ApiProperty({ type: PushSubscriptionKeysDto })
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class UnsubscribeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  endpoint: string;
}

const L = SETTINGS_LIMITS;

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({
    example: 3,
    minimum: L.intervalMonths.min,
    maximum: L.intervalMonths.max,
  })
  @IsInt()
  @Min(L.intervalMonths.min)
  @Max(L.intervalMonths.max)
  @IsOptional()
  weighingIntervalMonths?: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: L.intervalMonths.min,
    maximum: L.intervalMonths.max,
  })
  @IsInt()
  @Min(L.intervalMonths.min)
  @Max(L.intervalMonths.max)
  @IsOptional()
  healthIntervalMonths?: number;

  @ApiPropertyOptional({
    example: 3,
    minimum: L.weaningAgeMonths.min,
    maximum: L.weaningAgeMonths.max,
  })
  @IsInt()
  @Min(L.weaningAgeMonths.min)
  @Max(L.weaningAgeMonths.max)
  @IsOptional()
  weaningAgeMonths?: number;

  @ApiPropertyOptional({
    example: '2026-05-24',
    description: 'Seguir el destete de los nacidos desde esta fecha',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  weaningTrackingFrom?: string;

  @ApiPropertyOptional({
    example: 7,
    minimum: L.upcomingDays.min,
    maximum: L.upcomingDays.max,
  })
  @IsInt()
  @Min(L.upcomingDays.min)
  @Max(L.upcomingDays.max)
  @IsOptional()
  upcomingDays?: number;

  @ApiPropertyOptional({ example: 6, minimum: 0, maximum: 23 })
  @IsInt()
  @Min(L.runHour.min)
  @Max(L.runHour.max)
  @IsOptional()
  runHour?: number;
}

export enum ControlStateFilter {
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  TODAY = 'TODAY',
  UPCOMING = 'UPCOMING',
  LATER = 'LATER',
}

export class ListControlsQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: ControlType })
  @IsEnum(ControlType)
  type: ControlType;

  @ApiPropertyOptional({
    enum: ControlStateFilter,
    default: ControlStateFilter.PENDING,
    description:
      'PENDING = atrasados + hoy + próximos; OVERDUE, TODAY, UPCOMING, LATER (más adelante). Sin valor: PENDING',
  })
  @IsEnum(ControlStateFilter)
  @IsOptional()
  state?: ControlStateFilter;

  @ApiPropertyOptional({ description: 'Arete o nombre' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}

export class JustifyControlsDto {
  @ApiProperty({ enum: ControlType })
  @IsEnum(ControlType)
  type: ControlType;

  @ApiProperty({
    type: [String],
    description: 'Uno o varios animales (máx. 500)',
  })
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  animalIds: string[];

  @ApiProperty({ example: 'Cría débil: se desteta cuando gane peso' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;

  @ApiPropertyOptional({
    example: '2026-12-15',
    description:
      'Nueva fecha del control (posterior a hoy). Obligatoria en WEIGHING y HEALTH. En WEANING, sin fecha se cierra el destete.',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  nextDueDate?: string;
}

export class ListJustificationsQueryDto {
  @ApiPropertyOptional()
  @IsUUID('4')
  @IsOptional()
  animalId?: string;

  @ApiPropertyOptional({ enum: ControlType })
  @IsEnum(ControlType)
  @IsOptional()
  type?: ControlType;
}
