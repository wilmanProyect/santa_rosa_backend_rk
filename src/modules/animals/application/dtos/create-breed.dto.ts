import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Species } from '../../domain/enums/animal.enums';

export class CreateBreedDto {
  @ApiProperty({ enum: Species, example: Species.SHEEP })
  @IsEnum(Species)
  species: Species;

  @ApiProperty({
    example: 'Merino',
    description: 'Único por especie (sin distinguir mayúsculas)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
