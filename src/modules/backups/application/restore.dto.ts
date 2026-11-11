import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import { BACKUP_FILE_NAME } from './backup.service';
import { RESTORE_CONFIRMATION_WORD } from './restore.service';

export class StageServerFileDto {
  @ApiProperty({
    example: 'santa-rosa-respaldo-20261111-150835.tar.gz',
    description:
      'Nombre de un respaldo de la carpeta del servidor (GET /backups/files)',
  })
  @IsString()
  @MaxLength(200)
  @Matches(BACKUP_FILE_NAME, { message: 'Nombre de respaldo inválido' })
  fileName: string;
}

export class ConfirmRestoreDto {
  @ApiProperty({
    example: RESTORE_CONFIRMATION_WORD,
    description: `Debe ser exactamente "${RESTORE_CONFIRMATION_WORD}"`,
  })
  @IsString()
  @MaxLength(20)
  confirmation: string;
}
