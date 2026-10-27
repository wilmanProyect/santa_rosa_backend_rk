import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PHOTO_DESCRIPTION_MAX_LENGTH } from '../../domain/models/animal-photo.model';

/** Solo se actualizan los campos enviados. null vacía el campo. */
export class UpdateAnimalPhotoDto {
  @ApiPropertyOptional({ example: 'Vista lateral', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(PHOTO_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ example: '2026-10-20', nullable: true })
  @ValidateIf((_, value) => value !== null)
  @IsDateString({ strict: true })
  @IsOptional()
  takenAt?: string | null;
}
