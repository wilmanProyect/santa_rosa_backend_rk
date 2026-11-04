import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import { toDateOnly } from '@shared/domain/date-only';
import type {
  AnimalCertificateData,
  IAnimalCertificateRenderer,
  PedigreeNode,
} from '../../application/ports/animal-certificate-renderer.interface';
import { Animal } from '../../domain/models/animal.model';
import { AnimalStatus } from '../../domain/enums/animal.enums';
import {
  DOSE_UNIT_LABEL,
  ENTRY_ORIGIN_LABEL,
  GENETIC_CATEGORY_LABEL,
  HEALTH_TYPE_LABEL,
  PURITY_LABEL,
  ROUTE_LABEL,
  SEX_LABEL,
  STATUS_LABEL,
  WEIGHING_TYPE_LABEL,
} from './certificate-labels';

type Doc = PDFKit.PDFDocument;

const COLOR = {
  green: '#123f22',
  gold: '#c9a227',
  panel: '#e8e4d8',
  text: '#111111',
  muted: '#5c5a52',
  border: '#cfc8b4',
  zebra: '#f2eee3',
  warning: '#9a3412',
  warningBg: '#fff7ed',
};

const FONT = {
  regular: 'Times-Roman',
  bold: 'Times-Bold',
  italic: 'Times-Italic',
  /** Números de arete de los padres (como en el certificado impreso). */
  display: 'Helvetica-Bold',
};

/** Márgenes de las páginas del anexo: dejan lugar al logo y a la franja inferior. */
const ANNEX_MARGIN = { top: 96, bottom: 150, left: 40, right: 40 };
const EMPTY = '—';

/** Recuadros de la portada: borde izquierdo, ancho y alto del encabezado. */
const PANEL = { x: 29.7, width: 544.3, header: 27 };

interface Column {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

/** Imágenes del diseño del certificado, en `./assets`. */
interface Assets {
  background: Buffer;
  bottomBand: Buffer;
  logo: Buffer;
  goats: Buffer;
  slogan: Buffer;
  qr: Buffer;
}

let cachedAssets: Assets | null = null;

function assets(): Assets {
  const read = (name: string) => readFileSync(join(__dirname, 'assets', name));
  cachedAssets ??= {
    background: read('background.jpg'),
    bottomBand: read('bottom-band.png'),
    logo: read('logo.png'),
    goats: read('goats.png'),
    slogan: read('slogan.png'),
    qr: read('qr.png'),
  };
  return cachedAssets;
}

/**
 * Certificado del animal en PDF (A4), con el diseño del "Registro genealógico
 * y certificado de origen" de la cabaña: una portada con la identificación,
 * los padres y los criadores, y un anexo con el historial (pesos, sanidad).
 * Usa las fuentes estándar de PDF (Times, Helvetica), que cubren tildes y ñ
 * sin incrustar archivos de fuente.
 */
@Injectable()
export class PdfkitAnimalCertificateRenderer implements IAnimalCertificateRenderer {
  render(data: AnimalCertificateData): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: ANNEX_MARGIN,
      bufferPages: true,
      info: {
        Title: `Certificado ${data.number}`,
        Author: data.farm.name,
        Subject: `Certificado del animal ${describe(data.animal)}`,
      },
    });

    const done = new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    new CertificateWriter(doc, data, assets()).write();
    doc.end();
    return done;
  }
}

class CertificateWriter {
  private readonly left = ANNEX_MARGIN.left;
  private readonly width: number;
  private readonly pageWidth: number;

  constructor(
    private readonly doc: Doc,
    private readonly data: AnimalCertificateData,
    private readonly images: Assets,
  ) {
    this.pageWidth = doc.page.width;
    this.width = this.pageWidth - ANNEX_MARGIN.left - ANNEX_MARGIN.right;
  }

  write(): void {
    this.cover();
    this.annex();
    this.footers();
  }

  // ---------- Portada (diseño fijo) ----------

  private cover(): void {
    const { doc } = this;
    // Todo se ubica con coordenadas fijas: sin márgenes, pdfkit no agrega páginas.
    Object.assign(doc.page.margins, { top: 0, bottom: 0, left: 0, right: 0 });
    this.background();
    const { logo, goats, slogan } = this.images;
    doc.image(logo, 240.7, 12.1, { width: 147.8 });
    doc.image(goats, -3.2, -9.2, { width: 234.8 });
    doc.image(slogan, 471.7, 27, { width: 102 });

    this.centered('OVINOS Y CAPRINOS', 126.5, 12.8);
    this.centered('REGISTRO GENEALÓGICO Y', 146, 16.8);
    this.centered('CERTIFICADO DE ORIGEN', 164, 22.8);
    this.farmRule(199);

    this.identificationPanel(230.3);
    this.genealogyPanel(374.3);
    this.breederPanel(529.6);
    this.signatures(726);
    doc.image(this.images.qr, 509.2, 660.3, { width: 64.5 });
  }

  /** Nombre de la cabaña entre dos líneas. */
  private farmRule(y: number): void {
    const { doc } = this;
    const title = upper(this.data.farm.name);
    doc.font(FONT.bold).fontSize(9.8);
    const half = doc.widthOfString(title) / 2;
    const center = this.pageWidth / 2;
    this.centered(title, y, 9.8);
    const lineY = y + 3;
    doc.lineWidth(3).strokeColor(COLOR.green);
    doc
      .moveTo(center - half - 96, lineY)
      .lineTo(center - half - 16, lineY)
      .stroke();
    doc
      .moveTo(center + half + 16, lineY)
      .lineTo(center + half + 96, lineY)
      .stroke();
  }

  private identificationPanel(top: number): void {
    const { data } = this;
    const animal = data.animal;
    const bottom = top + 135;
    this.panel('I. IDENTIFICACIÓN DEL EJEMPLAR', top, bottom, 8);

    const birthDate = animal.getBirthDate();
    const alive = animal.getStatus() === AnimalStatus.ALIVE;
    const ageReference = alive
      ? toDateOnly(data.issuedAt)
      : animal.getStatusDate();
    const age =
      birthDate && ageReference ? formatAge(birthDate, ageReference) : null;
    const category = animal.getGeneticCategory();
    const absid = [
      animal.getAbsidRegistry(),
      animal.getAbsidCertificateCode()
        ? `cert. ${animal.getAbsidCertificateCode()}`
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const statusDate = animal.getStatusDate();
    const { birth, last } = data.weights;

    const rowsTop = top + PANEL.header + 6;
    this.coverFields(
      [
        ['Nombre', animal.getName()],
        ['Registro ABSID', absid],
        ['Raza', animal.getBreed().getName()],
        ['Sexo', SEX_LABEL[animal.getSex()]],
        [
          'Fecha de nacimiento',
          birthDate
            ? `${formatDate(birthDate)}${age ? ` (${age}${alive ? '' : ' a la salida'})` : ''}`
            : null,
        ],
        ['Color', animal.getColor()?.getName() ?? null],
        ['Categoría', category ? GENETIC_CATEGORY_LABEL[category] : null],
      ],
      PANEL.x + 5.5,
      rowsTop,
      262,
      7,
    );
    this.coverFields(
      [
        ['N.° de arete', animal.getEarTag()],
        ['Grado de pureza', category ? (PURITY_LABEL[category] ?? null) : null],
        ['Peso al nacer', birth ? formatKg(birth.weightKg) : null],
        [
          alive ? 'Peso actual' : 'Último peso',
          last
            ? `${formatKg(last.weightKg)} (${formatDate(last.weighedAt)})`
            : null,
        ],
        [
          'Estado',
          `${STATUS_LABEL[animal.getStatus()]}${!alive && statusDate ? ` el ${formatDate(statusDate)}` : ''}`,
        ],
        [
          'Fecha de registro',
          formatOptionalDate(animal.getEntryDate() ?? birthDate),
        ],
        ['Código cabaña', data.farm.code],
      ],
      302,
      rowsTop,
      266,
      7,
    );
  }

  private genealogyPanel(top: number): void {
    const { data } = this;
    this.panel('II. GENEALOGÍA', top, top + 137.3, 8);
    const boxTop = top + 40;
    this.parentBox(74.3, boxTop, 'PADRE', data.sire);
    this.parentBox(335, boxTop, 'MADRE', data.dam);
  }

  /** Padre o madre: arete grande, su nombre y registro, y sus propios padres. */
  private parentBox(
    x: number,
    y: number,
    label: string,
    node: PedigreeNode | null,
  ): void {
    const { doc } = this;
    const width = 187.1;
    const header = 28;
    const height = 88;
    doc
      .rect(x, y, width, height)
      .lineWidth(1.5)
      .strokeColor(COLOR.green)
      .stroke();
    doc.rect(x, y, width, header).fill(COLOR.green);
    doc
      .font(FONT.bold)
      .fontSize(10)
      .fillColor('#ffffff')
      .text(label, x, y + 9.5, { width, align: 'center', lineBreak: false });

    const inner = { x: x + 8, width: width - 16 };
    const line = (
      text: string,
      top: number,
      font: string,
      size: number,
      color: string,
    ) =>
      doc.font(font).fontSize(size).fillColor(color).text(text, inner.x, top, {
        width: inner.width,
        align: 'center',
        lineBreak: false,
        ellipsis: true,
      });

    const animal = node?.animal ?? null;
    if (!animal) {
      line('NO REGISTRADO', y + header + 20, FONT.bold, 9, COLOR.muted);
      return;
    }
    const tag = animal.getEarTag();
    line(
      upper(tag ?? describe(animal)),
      y + header + 7,
      FONT.display,
      11,
      COLOR.text,
    );
    const absid = animal.getAbsidRegistry();
    const detail = [
      tag ? animal.getName() : null,
      absid ? (/^absid/i.test(absid) ? absid : `ABSID ${absid}`) : null,
      animal.getBreed().getName(),
      animal.getIsExternal() ? 'Externo' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    line(upper(detail), y + header + 24, FONT.bold, 7, COLOR.muted);
    const grand = (title: string, parent: Animal | null) =>
      `${title}: ${parent ? describe(parent) : EMPTY}`;
    line(
      upper(`${grand('Abuelo', node!.sire)}   ${grand('Abuela', node!.dam)}`),
      y + header + 40,
      FONT.regular,
      6.5,
      COLOR.muted,
    );
  }

  private breederPanel(top: number): void {
    const { data } = this;
    this.panel('III. CRIADOR Y PROPIETARIO', top, top + 112.7, 9);
    const rowsTop = top + PANEL.header + 22;
    const issuer = data.issuedBy.fullName || data.issuedBy.username;
    this.coverFields(
      [
        ['Criador responsable', data.farm.breeders.join(' - ') || null],
        ['Localidad', data.farm.locality],
        ['Emitido por', issuer],
      ],
      38,
      rowsTop,
      290,
      8,
    );
    this.coverFields(
      [
        ['Teléfono', data.farm.phone],
        ['Fecha de emisión', formatDateTime(data.issuedAt, data.timeZone)],
        ['N.° de certificado', data.number],
      ],
      335,
      rowsTop,
      232,
      8,
    );
  }

  /** Bloques de firma de los criadores responsables. */
  private signatures(y: number): void {
    const { doc, data } = this;
    const names = data.farm.breeders.slice(0, 3);
    if (names.length === 0) return;
    const width = 200;
    const centers =
      names.length === 1
        ? [this.pageWidth / 2]
        : names.length === 2
          ? [131, 441]
          : [110, this.pageWidth / 2, 420];
    names.forEach((name, i) => {
      const x = centers[i] - width / 2;
      doc.font(FONT.bold).fontSize(8.5).fillColor(COLOR.text);
      [upper(name), 'CRIADOR RESPONSABLE', upper(data.farm.name)].forEach(
        (text, row) =>
          doc.text(text, x, y + row * 11.5, {
            width,
            align: 'center',
            lineBreak: false,
            ellipsis: true,
          }),
      );
    });
  }

  /** Recuadro con borde dorado y título sobre una banda. */
  private panel(
    title: string,
    top: number,
    bottom: number,
    titleSize: number,
  ): void {
    const { doc } = this;
    const { x, width, header } = PANEL;
    doc.rect(x, top, width, header).fill(COLOR.panel);
    doc.lineWidth(0.75).strokeColor(COLOR.gold);
    doc.rect(x, top, width, bottom - top).stroke();
    doc
      .moveTo(x, top + header)
      .lineTo(x + width, top + header)
      .stroke();
    doc
      .font(FONT.bold)
      .fontSize(titleSize)
      .fillColor(COLOR.green)
      .text(title, x, top + (header - titleSize) / 2, {
        width,
        align: 'center',
        lineBreak: false,
      });
  }

  /** "CAMPO: VALOR" en mayúsculas, una fila por campo. */
  private coverFields(
    rows: [string, string | null][],
    x: number,
    top: number,
    width: number,
    size: number,
  ): void {
    const { doc } = this;
    const step = size * 2.25;
    doc.font(FONT.bold).fontSize(size).fillColor(COLOR.text);
    rows.forEach(([label, value], i) => {
      const text = value && value.trim() !== '' ? value : EMPTY;
      doc.text(upper(`${label}: ${text}`), x, top + i * step, {
        width,
        lineBreak: false,
        ellipsis: true,
      });
    });
  }

  private centered(text: string, y: number, size: number): void {
    this.doc
      .font(FONT.bold)
      .fontSize(size)
      .fillColor(COLOR.green)
      .text(text, 0, y, {
        width: this.pageWidth,
        align: 'center',
        lineBreak: false,
      });
  }

  /** Fondo (paisaje) y franja inferior, comunes a todas las páginas. */
  private background(): void {
    const { doc } = this;
    const { background, bottomBand } = this.images;
    doc.image(background, -27.4, -17.7, { width: 680.5, height: 959.6 });
    doc.image(bottomBand, -3, 728.5, { width: 610 });
  }

  // ---------- Anexo: historial ----------

  private annex(): void {
    const { doc } = this;
    // Cada página del anexo, incluidas las que pdfkit agrega al desbordar.
    doc.on('pageAdded', () => {
      const { x, y } = doc;
      this.background();
      doc.image(this.images.logo, this.pageWidth / 2 - 45, 16, { width: 90 });
      doc.x = x;
      doc.y = y;
    });
    doc.addPage();
    doc.y = ANNEX_MARGIN.top;

    doc
      .font(FONT.bold)
      .fontSize(14)
      .fillColor(COLOR.green)
      .text('ANEXO · HISTORIAL DEL EJEMPLAR', this.left, doc.y, {
        width: this.width,
        align: 'center',
      });
    doc
      .font(FONT.regular)
      .fontSize(10)
      .fillColor(COLOR.muted)
      .text(
        `${describe(this.data.animal)}  ·  Certificado N.º ${this.data.number}`,
        { width: this.width, align: 'center' },
      );
    doc.moveDown(0.6);

    this.originAndStatus();
    this.weights();
    this.health();
    this.notes();
  }

  private originAndStatus(): void {
    const { doc, data } = this;
    const animal = data.animal;
    this.sectionTitle('Origen y estado', 170);

    const top = doc.y;
    const photoSize = 140;
    this.photo(this.left + this.width - photoSize, top, photoSize);
    doc.y = top;

    const origin = animal.getEntryOrigin();
    const rows: [string, string | null][] = [
      ['Origen', origin ? ENTRY_ORIGIN_LABEL[origin] : null],
      ['Fecha de ingreso', formatOptionalDate(animal.getEntryDate())],
      ['Cabaña de procedencia', animal.getSourceFarm()],
      ['Estado', STATUS_LABEL[animal.getStatus()]],
    ];
    if (animal.getStatus() !== AnimalStatus.ALIVE) {
      rows.push(
        ['Fecha del estado', formatOptionalDate(animal.getStatusDate())],
        ['Motivo', animal.getStatusReason()],
      );
    }
    rows.push(
      ['Registro externo', animal.getExternalRegistry()],
      ['Crías registradas', String(data.offspringCount)],
    );
    this.fields(rows, this.width - photoSize - 16);
    doc.y = Math.max(doc.y, top + photoSize + 14);

    if (animal.getIdentifierException()) {
      this.notice(
        `Caso especial: este animal comparte arete o registro ABSID con otro animal. Motivo: ${animal.getIdentifierExceptionReason() ?? EMPTY}`,
      );
    }
  }

  private weights(): void {
    const { data } = this;
    // Resumen + encabezado y primera fila de la tabla: que no queden partidos.
    this.sectionTitle('Pesos', data.weighings.length > 0 ? 150 : 90);
    const summary = (w: { weighedAt: string; weightKg: number } | null) =>
      w ? `${formatKg(w.weightKg)}  (${formatDate(w.weighedAt)})` : null;
    this.fields(
      [
        ['Al nacer', summary(data.weights.birth)],
        ['Al destete', summary(data.weights.weaning)],
        ['Último pesaje', summary(data.weights.last)],
      ],
      this.width,
    );

    if (data.weighings.length === 0) return;
    this.table(
      [
        { header: 'Fecha', width: 70 },
        { header: 'Tipo', width: 80 },
        { header: 'Peso', width: 70, align: 'right' },
        { header: 'C. corporal', width: 65, align: 'center' },
        { header: 'Observaciones', width: this.width - 285 },
      ],
      data.weighings.map((w) => [
        formatDate(w.getWeighedAt()),
        WEIGHING_TYPE_LABEL[w.getType()],
        `${formatKg(w.getWeightKg())}${w.getIsEstimated() ? ' *' : ''}`,
        w.getBodyConditionScore()?.toString().replace('.', ',') ?? EMPTY,
        w.getNotes() ?? '',
      ]),
    );
    const notes: string[] = [];
    if (data.weighings.some((w) => w.getIsEstimated())) {
      notes.push('* Peso estimado (sin balanza).');
    }
    if (data.totalWeighings > data.weighings.length) {
      notes.push(
        `Se muestran los ${data.weighings.length} pesajes más recientes de ${data.totalWeighings}.`,
      );
    }
    this.footnote(notes.join(' '));
  }

  private health(): void {
    const { data } = this;
    this.sectionTitle('Registro sanitario y de manejo');

    const { meat, milk } = data.withdrawal;
    if (meat) {
      this.notice(
        `Período de retiro de carne vigente por ${meat.productName} (aplicado el ${formatDate(meat.appliedAt)}): no faenar hasta el ${formatDate(meat.endsOn)}.`,
      );
    }
    if (milk) {
      this.notice(
        `Período de retiro de leche vigente por ${milk.productName}: no usar la leche hasta el ${formatDate(milk.endsOn)}.`,
      );
    }

    if (data.healthRecords.length === 0) {
      this.footnote('Sin eventos registrados.');
      return;
    }
    this.table(
      [
        { header: 'Fecha', width: 70 },
        { header: 'Tipo', width: 100 },
        { header: 'Producto', width: 105 },
        { header: 'Dosis / vía', width: 90 },
        { header: 'Motivo / observaciones', width: this.width - 365 },
      ],
      data.healthRecords.map((r) => {
        const quantity = r.getDoseQuantity();
        const unit = r.getDoseUnit();
        const route = r.getRoute();
        const dose = [
          quantity !== null
            ? `${formatNumber(quantity)}${unit ? ` ${DOSE_UNIT_LABEL[unit]}` : ''}`
            : null,
          route ? ROUTE_LABEL[route] : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return [
          `${formatDate(r.getAppliedAt())}${r.getIsDateEstimated() ? ' *' : ''}`,
          HEALTH_TYPE_LABEL[r.getType()],
          r.getProduct()?.name ?? EMPTY,
          dose || EMPTY,
          [r.getTargetCondition(), r.getNotes()].filter(Boolean).join('. '),
        ];
      }),
    );
    const notes: string[] = [];
    if (data.healthRecords.some((r) => r.getIsDateEstimated())) {
      notes.push('* Fecha aproximada.');
    }
    if (data.totalHealthRecords > data.healthRecords.length) {
      notes.push(
        `Se muestran los ${data.healthRecords.length} eventos más recientes de ${data.totalHealthRecords}.`,
      );
    }
    this.footnote(notes.join(' '));
  }

  private notes(): void {
    const notes = this.data.animal.getNotes();
    if (!notes) return;
    this.sectionTitle('Observaciones');
    this.doc
      .font(FONT.regular)
      .fontSize(10)
      .fillColor(COLOR.text)
      .text(notes, this.left, this.doc.y, { width: this.width });
  }

  /** Región al pie de todas las páginas; emisor y paginación en el anexo. */
  private footers(): void {
    const { doc, data } = this;
    const range = doc.bufferedPageRange();
    const issuedBy = data.issuedBy.fullName
      ? `${data.issuedBy.fullName} (${data.issuedBy.username})`
      : data.issuedBy.username;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      // Escribir dentro del margen inferior sin que pdfkit agregue una página.
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      if (data.farm.region) {
        doc
          .font(FONT.bold)
          .fontSize(9)
          .fillColor(COLOR.gold)
          .text(upper(data.farm.region), 0, 820, {
            width: this.pageWidth,
            align: 'center',
            lineBreak: false,
          });
      }
      if (i > range.start) {
        const y = doc.page.height - ANNEX_MARGIN.bottom + 14;
        const pageWidth = 80;
        doc
          .moveTo(this.left, y - 6)
          .lineTo(this.left + this.width, y - 6)
          .lineWidth(0.5)
          .strokeColor(COLOR.gold)
          .stroke();
        doc.font(FONT.regular).fontSize(8).fillColor(COLOR.muted);
        doc.text(
          `Emitido por ${issuedBy} el ${formatDateTime(data.issuedAt, data.timeZone)}.`,
          this.left,
          y,
          { width: this.width - pageWidth, lineBreak: false, ellipsis: true },
        );
        doc.text(
          `Página ${i - range.start + 1} de ${range.count}`,
          this.left + this.width - pageWidth,
          y,
          { width: pageWidth, align: 'right', lineBreak: false },
        );
        doc.text(
          `Certificado N.º ${data.number}. Generado con los datos registrados en el sistema a la fecha de emisión.`,
          this.left,
          y + 11,
          { width: this.width, lineBreak: false, ellipsis: true },
        );
      }
      doc.page.margins.bottom = bottom;
    }
  }

  // ---------- Piezas del anexo ----------

  private sectionTitle(title: string, minSpace = 60): void {
    const { doc } = this;
    this.ensureSpace(minSpace);
    doc.moveDown(0.4);
    doc
      .font(FONT.bold)
      .fontSize(11.5)
      .fillColor(COLOR.green)
      .text(title.toUpperCase(), this.left, doc.y, { width: this.width });
    const y = doc.y + 2;
    doc
      .moveTo(this.left, y)
      .lineTo(this.left + this.width, y)
      .lineWidth(0.75)
      .strokeColor(COLOR.gold)
      .stroke();
    doc.y = y + 8;
  }

  /** Pares "campo: valor" en una columna del ancho indicado. */
  private fields(rows: [string, string | null][], width: number): void {
    const { doc } = this;
    const labelWidth = Math.min(160, width * 0.4);
    for (const [label, value] of rows) {
      const text = value && value.trim() !== '' ? value : EMPTY;
      doc.font(FONT.regular).fontSize(10);
      const height = Math.max(
        doc.heightOfString(text, { width: width - labelWidth }),
        12,
      );
      this.ensureSpace(height + 4);
      const y = doc.y;
      doc
        .fillColor(COLOR.muted)
        .text(label, this.left, y, { width: labelWidth - 6 });
      doc
        .font(FONT.bold)
        .fillColor(COLOR.text)
        .text(text, this.left + labelWidth, y, { width: width - labelWidth });
      doc.y = y + height + 4;
    }
    doc.moveDown(0.3);
  }

  private photo(x: number, y: number, size: number): void {
    const { doc, data } = this;
    doc
      .rect(x, y, size, size)
      .lineWidth(0.75)
      .fillAndStroke('#ffffff', COLOR.gold);
    if (!data.photoJpeg) {
      doc
        .font(FONT.italic)
        .fontSize(9)
        .fillColor(COLOR.muted)
        .text('Sin foto', x, y + size / 2 - 5, {
          width: size,
          align: 'center',
        });
      return;
    }
    doc.image(data.photoJpeg, x + 2, y + 2, {
      fit: [size - 4, size - 4],
      align: 'center',
      valign: 'center',
    });
    if (data.photoTakenAt) {
      doc
        .font(FONT.regular)
        .fontSize(8)
        .fillColor(COLOR.muted)
        .text(`Foto del ${formatDate(data.photoTakenAt)}`, x, y + size + 2, {
          width: size,
          align: 'center',
        });
    }
  }

  /** Tabla con encabezado que se repite al pasar de página. */
  private table(columns: Column[], rows: string[][]): void {
    const { doc } = this;
    const padding = 4;
    const drawHeader = () => {
      const y = doc.y;
      doc.rect(this.left, y, this.width, 18).fill(COLOR.panel);
      let x = this.left;
      doc.font(FONT.bold).fontSize(9).fillColor(COLOR.green);
      for (const column of columns) {
        doc.text(column.header, x + padding, y + 5, {
          width: column.width - padding * 2,
          align: column.align ?? 'left',
          lineBreak: false,
        });
        x += column.width;
      }
      doc.y = y + 18;
    };

    this.ensureSpace(40);
    drawHeader();
    rows.forEach((row, index) => {
      doc.font(FONT.regular).fontSize(9);
      const height =
        Math.max(
          ...row.map((cell, i) =>
            doc.heightOfString(cell || ' ', {
              width: columns[i].width - padding * 2,
            }),
          ),
        ) +
        padding * 2;
      if (this.ensureSpace(height)) drawHeader();
      const y = doc.y;
      doc
        .rect(this.left, y, this.width, height)
        .fill(index % 2 === 1 ? COLOR.zebra : '#ffffff');
      let x = this.left;
      doc.font(FONT.regular).fontSize(9).fillColor(COLOR.text);
      row.forEach((cell, i) => {
        doc.text(cell, x + padding, y + padding, {
          width: columns[i].width - padding * 2,
          align: columns[i].align ?? 'left',
        });
        x += columns[i].width;
      });
      doc.y = y + height;
    });
    doc.moveDown(0.3);
  }

  private notice(text: string): void {
    const { doc } = this;
    doc.font(FONT.bold).fontSize(9.5);
    const height = doc.heightOfString(text, { width: this.width - 16 }) + 12;
    this.ensureSpace(height + 6);
    const y = doc.y;
    doc
      .rect(this.left, y, this.width, height)
      .fillAndStroke(COLOR.warningBg, COLOR.warning);
    doc
      .fillColor(COLOR.warning)
      .text(text, this.left + 8, y + 6, { width: this.width - 16 });
    doc.y = y + height + 6;
  }

  private footnote(text: string): void {
    if (!text) return;
    this.doc
      .font(FONT.italic)
      .fontSize(8.5)
      .fillColor(COLOR.muted)
      .text(text, this.left, this.doc.y, { width: this.width });
    this.doc.moveDown(0.3);
  }

  /** Pasa a una página nueva si no entra `height`. Devuelve true si cambió. */
  private ensureSpace(height: number): boolean {
    const { doc } = this;
    const limit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + height <= limit) return false;
    doc.addPage();
    doc.y = doc.page.margins.top;
    return true;
  }
}

// ---------- Formato ----------

/** "SR-0154 · Lucero", o lo que se tenga. */
function describe(animal: Animal): string {
  return (
    [animal.getEarTag(), animal.getName()].filter(Boolean).join(' · ') ||
    animal.getExternalRegistry() ||
    animal.getAbsidRegistry() ||
    'Sin identificación'
  );
}

function upper(text: string): string {
  return text.toLocaleUpperCase('es');
}

/** YYYY-MM-DD → DD/MM/YYYY */
function formatDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}/${m}/${y}`;
}

function formatOptionalDate(date: string | null): string | null {
  return date ? formatDate(date) : null;
}

function formatDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatKg(value: number): string {
  return `${formatNumber(value)} kg`;
}

/** "2 años y 3 meses", "5 meses", "12 días". */
export function formatAge(from: string, to: string): string | null {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (td < fd) months -= 1;
  if (months < 0) return null;
  if (months === 0) {
    const days = Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    );
    return `${days} día${days === 1 ? '' : 's'}`;
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearsText = years > 0 ? `${years} año${years === 1 ? '' : 's'}` : '';
  const monthsText = rest > 0 ? `${rest} mes${rest === 1 ? '' : 'es'}` : '';
  return [yearsText, monthsText].filter(Boolean).join(' y ');
}
