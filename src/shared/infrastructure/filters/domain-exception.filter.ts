import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { DomainError } from '@shared/domain/errors/domain.error';

const PG_UNIQUE_VIOLATION = '23505';
const PG_FOREIGN_KEY_VIOLATION = '23503';
const PG_INVALID_TEXT_REPRESENTATION = '22P02';

/**
 * Traduce errores de dominio y de base de datos a respuestas HTTP coherentes
 * en lugar de devolver un 500 genérico.
 */
@Catch(DomainError, QueryFailedError)
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: DomainError | QueryFailedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      this.send(response, HttpStatus.BAD_REQUEST, exception.message);
      return;
    }

    const driverError = exception.driverError as { code?: string } | undefined;
    switch (driverError?.code) {
      case PG_UNIQUE_VIOLATION:
        this.send(
          response,
          HttpStatus.CONFLICT,
          'Ya existe un registro con esos datos',
        );
        return;
      case PG_FOREIGN_KEY_VIOLATION:
        this.send(
          response,
          HttpStatus.CONFLICT,
          'El registro está relacionado con otros datos',
        );
        return;
      case PG_INVALID_TEXT_REPRESENTATION:
        this.send(response, HttpStatus.BAD_REQUEST, 'Formato de dato inválido');
        return;
      default:
        this.logger.error(exception.message, exception.stack);
        this.send(
          response,
          HttpStatus.INTERNAL_SERVER_ERROR,
          'Error interno del servidor',
        );
    }
  }

  private send(response: Response, statusCode: HttpStatus, message: string) {
    response.status(statusCode).json({ statusCode, message });
  }
}
