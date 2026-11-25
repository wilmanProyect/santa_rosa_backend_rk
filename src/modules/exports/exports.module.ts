import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EXPORT_TIME_ZONE, ExportService } from './application/export.service';
import { ExportTypeormRepository } from './infrastructure/export.typeorm.repository';
import { XlsxExportBuilder } from './infrastructure/xlsx-export.builder';
import { ExportController } from './infrastructure/export.controller';

/**
 * Exportación a Excel (GET /exports/excel): animales, registro sanitario,
 * montas y partos, en un solo archivo con una hoja por tabla.
 */
@Module({
  controllers: [ExportController],
  providers: [
    ExportTypeormRepository,
    XlsxExportBuilder,
    ExportService,
    {
      provide: EXPORT_TIME_ZONE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>('FARM_TIME_ZONE') || 'America/La_Paz',
    },
  ],
})
export class ExportsModule {}
