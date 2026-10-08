import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AccessTokenPayload,
  ITokenService,
} from '../../domain/ports/token-service.interface';

@Injectable()
export class JwtTokenServiceAdapter implements ITokenService {
  constructor(private readonly jwtService: JwtService) {}

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync({ sub: payload.sub, sid: payload.sid });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const payload =
      await this.jwtService.verifyAsync<Partial<AccessTokenPayload>>(token);
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      throw new Error('Payload de token inválido');
    }
    return { sub: payload.sub, sid: payload.sid };
  }
}
