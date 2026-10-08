import { DomainError } from '@shared/domain/errors/domain.error';
import { assertPasswordPolicy } from './password-policy';

describe('assertPasswordPolicy', () => {
  it.each(['Admin123', 'NuevaClave2026'])('acepta "%s"', (password) => {
    expect(() => assertPasswordPolicy(password)).not.toThrow();
  });

  it.each([
    ['muy corta', 'Ab1'],
    ['sin mayúscula', 'admin1234'],
    ['sin minúscula', 'ADMIN1234'],
    ['sin número', 'AdminAdmin'],
    ['más de 72 bytes', `Aa1${'x'.repeat(70)}`],
  ])('rechaza una contraseña %s', (_, password) => {
    expect(() => assertPasswordPolicy(password)).toThrow(DomainError);
  });
});
