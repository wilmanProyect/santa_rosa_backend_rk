/**
 * Error lanzado cuando se viola una regla de negocio del dominio.
 * El filtro global lo traduce a una respuesta HTTP 400.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
