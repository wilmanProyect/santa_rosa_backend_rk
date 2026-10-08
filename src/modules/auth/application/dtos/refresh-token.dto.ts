import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token recibido en el login o en el último refresh',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  refreshToken: string;
}
