export interface AccessTokenPayload {
  /** ID del usuario. */
  sub: string;
  /** ID de la sesión. */
  sid: string;
}

export interface ITokenService {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  /** Lanza un error si el token es inválido o expiró. */
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
}

export const TOKEN_SERVICE = Symbol('ITokenService');
