import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateAnimalColorDto {
  @ApiProperty({
    example: 'Blanco',
    description: 'Único (sin distinguir mayúsculas)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
