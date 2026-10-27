import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { PHOTO_DESCRIPTION_MAX_LENGTH } from '../../domain/models/animal-photo.model';

/** Campos de texto que acompañan al archivo en el formulario multipart. */
export class UploadAnimalPhotoDto {
  @ApiPropertyOptional({
    example: 'Al destete, vista lateral',
    maxLength: PHOTO_DESCRIPTION_MAX_LENGTH,
  })
  @IsString()
  @MaxLength(PHOTO_DESCRIPTION_MAX_LENGTH)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: '2026-10-20',
    description:
      'Fecha en que se tomó la foto (YYYY-MM-DD). Si se omite, se usa la del EXIF de la cámara cuando existe.',
  })
  @IsDateString({ strict: true })
  @IsOptional()
  takenAt?: string;
}
