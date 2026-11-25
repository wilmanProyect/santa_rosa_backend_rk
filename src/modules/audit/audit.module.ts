import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AUDIT_EVENTS } from '@shared/application/ports/audit-events.interface';
import { AUDIT_TIME_ZONE, AuditService } from './application/audit.service';
import { AuditTypeormRepository } from './infrastructure/audit.typeorm.repository';
import { AuditController } from './infrastructure/audit.controller';
import { AuditContextInterceptor } from './infrastructure/audit-context.interceptor';
import { AuditDbSession } from './infrastructure/audit-db-session';

/**
 * Registro de actividad. Los cambios de datos los guardan triggers de la base
 * (migración AuditLog); este módulo les pasa el usuario de cada petición,
 * registra las acciones (AUDIT_EVENTS, disponible en toda la app) y expone la
 * consulta.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditTypeormRepository,
    AuditService,
    AuditDbSession,
    { provide: AUDIT_EVENTS, useExisting: AuditService },
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
    {
      provide: AUDIT_TIME_ZONE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('FARM_TIME_ZONE') || 'America/La_Paz',
    },
  ],
  exports: [AUDIT_EVENTS],
})
export class AuditModule {}
