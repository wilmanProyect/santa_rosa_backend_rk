import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  DOSE_UNIT_LABEL,
  ENTRY_ORIGIN_LABEL,
  GENETIC_CATEGORY_LABEL,
  HEALTH_TYPE_LABEL,
  ROUTE_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
  STATUS_LABEL,
} from '@modules/animals/infrastructure/certificates/certificate-labels';
import { ExportData, ExportRow } from '../domain/export.types';

const SERVICE_TYPE_LABEL: Record<string, string> = {
  DIRECTED: 'Monta dirigida',
  ARTIFICIAL_INSEMINATION: 'Inseminación artificial',
};
const SERVICE_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Sin diagnóstico',
  PREGNANT: 'Preñada',
  EMPTY: 'Vacía',
  BIRTHED: 'Parió',
  ABORTED: 'Abortó',
  DAM_DIED: 'Madre muerta',
};
const CHECK_METHOD_LABEL: Record<string, string> = {
  ULTRASOUND: 'Ecografía',
  OBSERVATION: 'Observación',
};
const CHECK_RESULT_LABEL: Record<string, string> = {
  PREGNANT: 'Preñada',
  EMPTY: 'Vacía',
};
const ASSISTANCE_LABEL: Record<string, string> = {
  NORMAL: 'Normal',
  ASSISTED: 'Asistido',
  CESAREAN: 'Cesárea',
};

type Kind = 'text' | 'date' | 'number' | 'money' | 'percent' | 'bool';

interface Column {
  header: string;
  key: string;
  kind?: Kind;
  width?: number;
  /** Etiquetas de los valores fijos. */
  labels?: Record<string, string>;
}

interface SheetSpec {
  name: string;
  columns: Column[];
  rows: ExportRow[] | undefined;
}

const NUM_FMT: Partial<Record<Kind, string>> = {
  date: 'dd/mm/yyyy',
  number: '#,##0.##',
  money: '#,##0.00',
  percent: '0.00%',
};

export interface WorkbookInfo {
  generatedAt: Date;
  timeZone: string;
  generatedBy: string;
  filters: [label: string, value: string][];
  showPrice: boolean;
}

/** Arma el Excel de la exportación: una hoja de resumen y una por cada tabla. */
@Injectable()
export class XlsxExportBuilder {
  async build(data: ExportData, info: WorkbookInfo): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Cabaña Santa Rosa';
    workbook.created = info.generatedAt;

    const sheets = this.sheets(data, info.showPrice).filter((s) => s.rows);
    this.summary(workbook, sheets, info);
    for (const spec of sheets) this.sheet(workbook, spec);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private sheets(data: ExportData, showPrice: boolean): SheetSpec[] {
    return [
      {
        name: 'Animales',
        rows: data.animals,
        columns: [
          { header: 'Arete', key: 'ear_tag', width: 12 },
          { header: 'Nombre', key: 'name', width: 18 },
          { header: 'Externo', key: 'is_external', kind: 'bool' },
          { header: 'Especie', key: 'species', labels: SPECIES_LABEL },
          { header: 'Raza', key: 'breed', width: 16 },
          { header: 'Sexo', key: 'sex', labels: SEX_LABEL },
          { header: 'Color', key: 'color' },
          {
            header: 'Categoría genética',
            key: 'genetic_category',
            labels: GENETIC_CATEGORY_LABEL,
            width: 20,
          },
          {
            header: 'Categoría confirmada',
            key: 'genetic_category_confirmed',
            kind: 'bool',
          },
          { header: 'Registro ABSID', key: 'absid_registry', width: 16 },
          { header: 'Código certificado ABSID', key: 'absid_certificate_code' },
          { header: 'Registro externo', key: 'external_registry' },
          { header: 'Fecha de nacimiento', key: 'birth_date', kind: 'date' },
          { header: 'Madre', key: 'dam', width: 20 },
          { header: 'Padre', key: 'sire', width: 20 },
          {
            header: 'Origen',
            key: 'entry_origin',
            labels: ENTRY_ORIGIN_LABEL,
            width: 18,
          },
          { header: 'Fecha de ingreso', key: 'entry_date', kind: 'date' },
          { header: 'Procedencia', key: 'source_farm', width: 18 },
          { header: 'Estado', key: 'status', labels: STATUS_LABEL, width: 18 },
          { header: 'Fecha del estado', key: 'status_date', kind: 'date' },
          { header: 'Detalle del estado', key: 'status_reason', width: 24 },
          {
            header: 'Peso al nacer (kg)',
            key: 'birth_weight_kg',
            kind: 'number',
          },
          { header: 'Fecha de destete', key: 'weaning_date', kind: 'date' },
          {
            header: 'Peso al destete (kg)',
            key: 'weaning_weight_kg',
            kind: 'number',
          },
          { header: 'Último pesaje', key: 'last_weighed_at', kind: 'date' },
          {
            header: 'Último peso (kg)',
            key: 'last_weight_kg',
            kind: 'number',
          },
          {
            header: 'Caso especial',
            key: 'identifier_exception',
            kind: 'bool',
          },
          {
            header: 'Motivo del caso especial',
            key: 'identifier_exception_reason',
            width: 24,
          },
          { header: 'Observaciones', key: 'notes', width: 30 },
          ...(showPrice
            ? [
                {
                  header: 'Precio (Bs)',
                  key: 'price',
                  kind: 'money' as const,
                },
              ]
            : []),
        ],
      },
      {
        name: 'Registro sanitario',
        rows: data.health,
        columns: [
          { header: 'Fecha', key: 'applied_at', kind: 'date' },
          { header: 'Fecha estimada', key: 'is_date_estimated', kind: 'bool' },
          {
            header: 'Tipo',
            key: 'type',
            labels: HEALTH_TYPE_LABEL,
            width: 22,
          },
          { header: 'Animal', key: 'animal', width: 20 },
          { header: 'Especie', key: 'species', labels: SPECIES_LABEL },
          { header: 'Producto', key: 'product', width: 20 },
          { header: 'Lote', key: 'product_batch' },
          { header: 'Dosis', key: 'dose_quantity', kind: 'number' },
          { header: 'Unidad', key: 'dose_unit', labels: DOSE_UNIT_LABEL },
          { header: 'Vía', key: 'route', labels: ROUTE_LABEL },
          {
            header: 'Enfermedad / diagnóstico',
            key: 'target_condition',
            width: 22,
          },
          { header: 'Aplicado por', key: 'applied_by', width: 16 },
          { header: 'Lugar', key: 'location' },
          { header: 'Próxima dosis', key: 'next_dose_at', kind: 'date' },
          {
            header: 'Retiro carne (días)',
            key: 'meat_withdrawal_days',
            kind: 'number',
          },
          {
            header: 'Retiro leche (días)',
            key: 'milk_withdrawal_days',
            kind: 'number',
          },
          { header: 'Costo (Bs)', key: 'cost', kind: 'money' },
          { header: 'Observaciones', key: 'notes', width: 30 },
        ],
      },
      {
        name: 'Montas',
        rows: data.services,
        columns: [
          { header: 'Fecha de la monta', key: 'service_date', kind: 'date' },
          { header: 'Fecha de salida', key: 'exit_date', kind: 'date' },
          { header: 'Especie', key: 'species', labels: SPECIES_LABEL },
          {
            header: 'Tipo',
            key: 'type',
            labels: SERVICE_TYPE_LABEL,
            width: 22,
          },
          { header: 'Madre', key: 'dam', width: 20 },
          { header: 'Padre', key: 'sire', width: 20 },
          { header: 'Padre externo', key: 'sire_external', kind: 'bool' },
          { header: 'Pajuela', key: 'straw_code' },
          {
            header: 'Parto esperado',
            key: 'expected_birth_date',
            kind: 'date',
          },
          {
            header: 'Estado',
            key: 'status',
            labels: SERVICE_STATUS_LABEL,
            width: 16,
          },
          {
            header: 'Categoría esperada de la cría',
            key: 'expected_offspring_category',
            labels: GENETIC_CATEGORY_LABEL,
            width: 20,
          },
          {
            header: 'Consanguinidad',
            key: 'inbreeding_coefficient',
            kind: 'percent',
          },
          {
            header: 'Justificación del parentesco',
            key: 'kinship_override_reason',
            width: 24,
          },
          { header: 'Último diagnóstico', key: 'last_check_at', kind: 'date' },
          {
            header: 'Método',
            key: 'last_check_method',
            labels: CHECK_METHOD_LABEL,
          },
          {
            header: 'Resultado',
            key: 'last_check_result',
            labels: CHECK_RESULT_LABEL,
          },
          { header: 'Fetos', key: 'last_check_fetuses', kind: 'number' },
          { header: 'Fecha del parto', key: 'birth_date', kind: 'date' },
          { header: 'Fecha del aborto', key: 'abortion_date', kind: 'date' },
          { header: 'Causa del aborto', key: 'abortion_cause', width: 22 },
          {
            header: 'Muerte de la madre',
            key: 'dam_death_date',
            kind: 'date',
          },
          { header: 'Causa de la muerte', key: 'dam_death_cause', width: 22 },
          { header: 'Observaciones', key: 'notes', width: 30 },
        ],
      },
      {
        name: 'Diagnósticos',
        rows: data.checks,
        columns: [
          { header: 'Fecha', key: 'checked_at', kind: 'date' },
          { header: 'Madre', key: 'dam', width: 20 },
          { header: 'Padre', key: 'sire', width: 20 },
          { header: 'Fecha de la monta', key: 'service_date', kind: 'date' },
          { header: 'Especie', key: 'species', labels: SPECIES_LABEL },
          { header: 'Método', key: 'method', labels: CHECK_METHOD_LABEL },
          { header: 'Resultado', key: 'result', labels: CHECK_RESULT_LABEL },
          { header: 'Fetos', key: 'fetus_count', kind: 'number' },
          { header: 'Observaciones', key: 'notes', width: 30 },
        ],
      },
      {
        name: 'Partos',
        rows: data.births,
        columns: [
          { header: 'Fecha', key: 'birth_date', kind: 'date' },
          { header: 'Especie', key: 'species', labels: SPECIES_LABEL },
          { header: 'Madre', key: 'dam', width: 20 },
          { header: 'Padre', key: 'sire', width: 20 },
          { header: 'Fecha de la monta', key: 'service_date', kind: 'date' },
          { header: 'Asistencia', key: 'assistance', labels: ASSISTANCE_LABEL },
          { header: 'Histórico', key: 'is_historical', kind: 'bool' },
          { header: 'Crías', key: 'offspring', kind: 'number' },
          { header: 'Nacidas vivas', key: 'born_alive', kind: 'number' },
          { header: 'Observaciones', key: 'notes', width: 30 },
        ],
      },
      {
        name: 'Crías',
        rows: data.offspring,
        columns: [
          { header: 'Fecha del parto', key: 'birth_date', kind: 'date' },
          { header: 'Madre', key: 'dam', width: 20 },
          { header: 'Padre', key: 'sire', width: 20 },
          { header: 'N.º de cría', key: 'position', kind: 'number' },
          { header: 'Sexo', key: 'sex', labels: SEX_LABEL },
          { header: 'Nació viva', key: 'born_alive', kind: 'bool' },
          {
            header: 'Peso al nacer (kg)',
            key: 'birth_weight_kg',
            kind: 'number',
          },
          { header: 'Animal registrado', key: 'animal', width: 20 },
          {
            header: 'Estado actual',
            key: 'animal_status',
            labels: STATUS_LABEL,
            width: 18,
          },
        ],
      },
    ];
  }

  private summary(
    workbook: ExcelJS.Workbook,
    sheets: SheetSpec[],
    info: WorkbookInfo,
  ): void {
    const ws = workbook.addWorksheet('Resumen');
    ws.columns = [{ width: 28 }, { width: 40 }];
    ws.addRow(['Cabaña Santa Rosa: exportación de datos']).font = {
      bold: true,
      size: 14,
    };
    ws.addRow([]);
    const generatedAt = new Intl.DateTimeFormat('es-BO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: info.timeZone,
    }).format(info.generatedAt);
    ws.addRow(['Generado', generatedAt]);
    ws.addRow(['Por', info.generatedBy]);
    for (const [label, value] of info.filters) ws.addRow([label, value]);
    ws.addRow([]);
    ws.addRow(['Hoja', 'Registros']).font = { bold: true };
    for (const s of sheets) ws.addRow([s.name, s.rows!.length]);
  }

  private sheet(workbook: ExcelJS.Workbook, spec: SheetSpec): void {
    const ws = workbook.addWorksheet(spec.name, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = spec.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width ?? Math.max(12, c.header.length + 2),
      style: NUM_FMT[c.kind ?? 'text']
        ? { numFmt: NUM_FMT[c.kind ?? 'text'] }
        : {},
    }));
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8EEE4' },
    };
    for (const row of spec.rows!) {
      ws.addRow(
        Object.fromEntries(spec.columns.map((c) => [c.key, cell(c, row)])),
      );
    }
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: spec.columns.length },
    };
  }
}

export function cell(
  column: Pick<Column, 'key' | 'kind' | 'labels'>,
  row: ExportRow,
): string | number | Date | null {
  const value = row[column.key];
  if (value === null || value === undefined || value === '') return null;
  switch (column.kind) {
    case 'date':
      // Fecha sin hora: medianoche UTC, que Excel muestra como ese mismo día.
      return new Date(`${String(value)}T00:00:00Z`);
    case 'number':
    case 'money':
    case 'percent':
      return Number(value);
    case 'bool':
      return value === true ? 'Sí' : 'No';
    default:
      return column.labels?.[String(value)] ?? String(value);
  }
}
