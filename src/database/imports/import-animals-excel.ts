/**
 * Importa el inventario de animales, sus pesajes y su registro sanitario desde
 * las planillas Excel (exportadas como CSV UTF-8 separado por ";").
 *
 *   pnpm import:animals <Animales.csv> [Pesaje.csv] [Registro_Sanitario.csv] --dry-run
 *   pnpm import:animals <Animales.csv> [Pesaje.csv] [Registro_Sanitario.csv]
 *
 * Cada registro pasa por las reglas del modelo de dominio y todo se guarda en
 * una sola transacción: si algo falla, no se guarda nada. Se niega a correr si
 * la tabla de animales ya tiene registros.
 *
 * Las decisiones de mapeo se acordaron con la cabaña (ver
 * docs/REVISION_DATOS_PRODUCCION.md) y quedan explicadas en el reporte
 * (`<Animales>.reporte.md`, junto al CSV).
 */
import 'reflect-metadata';
import { readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { EntityManager } from 'typeorm';
import dataSource from '../data-source';
import { DomainError } from '@shared/domain/errors/domain.error';
import { Animal } from '@modules/animals/domain/models/animal.model';
import { AnimalParent } from '@modules/animals/domain/models/animal-parent';
import { Breed } from '@modules/animals/domain/models/breed.model';
import { AnimalColor } from '@modules/animals/domain/models/animal-color.model';
import {
  AnimalStatus,
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import {
  AnimalWeighing,
  WeighingType,
  weighingWarnings,
} from '@modules/animals/domain/models/animal-weighing.model';
import {
  HealthEventType,
  HealthRecord,
  HealthRecordData,
} from '@modules/animals/domain/models/health-record.model';
import { VeterinaryProduct } from '@modules/veterinary/domain/models/veterinary-product.model';
import {
  DoseUnit,
  ProductCategory,
} from '@modules/veterinary/domain/enums/veterinary.enums';
import { AnimalMapper } from '@modules/animals/infrastructure/persistence/mappers/animal.mapper';
import { BreedMapper } from '@modules/animals/infrastructure/persistence/mappers/breed.mapper';
import { AnimalColorMapper } from '@modules/animals/infrastructure/persistence/mappers/animal-color.mapper';
import { AnimalWeighingMapper } from '@modules/animals/infrastructure/persistence/mappers/animal-weighing.mapper';
import { HealthRecordMapper } from '@modules/animals/infrastructure/persistence/mappers/health-record.mapper';
import { VeterinaryProductMapper } from '@modules/veterinary/infrastructure/persistence/mappers/veterinary-product.mapper';
import { AnimalOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal.orm-entity';
import { BreedOrmEntity } from '@modules/animals/infrastructure/persistence/entities/breed.orm-entity';
import { AnimalColorOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal-color.orm-entity';
import { AnimalWeighingOrmEntity } from '@modules/animals/infrastructure/persistence/entities/animal-weighing.orm-entity';
import { HealthRecordOrmEntity } from '@modules/animals/infrastructure/persistence/entities/health-record.orm-entity';
import { VeterinaryProductOrmEntity } from '@modules/veterinary/infrastructure/persistence/entities/veterinary-product.orm-entity';

// ---------------------------------------------------------------------------
// Configuración del mapeo (acordada con la cabaña)
// ---------------------------------------------------------------------------

const BREEDS: Record<string, { name: string; species: Species }> = {
  'SANTA INES': { name: 'Santa Inés', species: Species.SHEEP },
  DORPER: { name: 'Dorper', species: Species.SHEEP },
  'WHITE DORPER': { name: 'White Dorper', species: Species.SHEEP },
  BOER: { name: 'Boer', species: Species.GOAT },
  SAANEN: { name: 'Saanen', species: Species.GOAT },
};

/** Valor de la planilla (mayúsculas, sin tildes) → color del catálogo. */
const COLORS: Record<string, string> = {
  NEGRO: 'Negro',
  NEGRA: 'Negro',
  'NEGRO LANUDO': 'Negro lanudo',
  'NEGRO LANUDA': 'Negro lanudo',
  'NEGRO LANA': 'Negro lanudo',
  'NEGRO PELO BLANCO': 'Negro pelo blanco',
  'NEGRA PELO BLANCO': 'Negro pelo blanco',
  BLANCO: 'Blanco',
  BLANCA: 'Blanco',
  OVERO: 'Overo',
  'OVERO BLANCO': 'Overo blanco',
  'OVERA NEGRA': 'Overo negro',
  CHOCOLATE: 'Café',
  CHOCA: 'Café',
  CHOCO: 'Café',
  'CAFE - CHOCOLATE': 'Café',
  'CAFE CHOCOLATE': 'Café',
  'OVEJA CHOCA': 'Café',
  // Sin equivalente exacto en la lista acordada: se asigna el más cercano y
  // el valor original queda en las observaciones.
  'CHOCO LANUDO': 'Café',
  'CHOCA LANUDA': 'Café',
  'NEGRO PINTADO': 'Overo negro',
  'NEGRO PINTADA': 'Overo negro',
  'OVERA CAFE': 'Overo',
};
const APPROXIMATE_COLORS = new Set([
  'CHOCO LANUDO',
  'CHOCA LANUDA',
  'NEGRO PINTADO',
  'NEGRO PINTADA',
  'OVERA CAFE',
]);

const STATUSES: Record<string, AnimalStatus> = {
  VIVO: AnimalStatus.ALIVE,
  RESERVADO: AnimalStatus.ALIVE,
  VENDIDO: AnimalStatus.SOLD,
  MUERTO: AnimalStatus.DEAD,
  FANEADO: AnimalStatus.SLAUGHTERED,
  DEGUSTACION: AnimalStatus.SLAUGHTERED,
  REGALO: AnimalStatus.GIFTED,
  INTERCAMBIO: AnimalStatus.EXCHANGED,
  PERDIDO: AnimalStatus.LOST,
};

/** "POR DEFINIR" queda sin categoría (se completa después en el sistema). */
const GENETIC_CATEGORIES: Record<string, GeneticCategory | null> = {
  'POR DEFINIR': null,
  COMERCIAL: GeneticCategory.COMMERCIAL,
  BASE: GeneticCategory.BASE,
  G1: GeneticCategory.G1,
  G2: GeneticCategory.G2,
  G3: GeneticCategory.G3,
  G4: GeneticCategory.G4,
  PO: GeneticCategory.PO,
};

/** Columna "compra de Cabaña": texto (en minúsculas, sin tildes, empieza con) → compra. */
const PURCHASES: {
  startsWith: string;
  farm: string;
  entryDate: string | null;
}[] = [
  {
    startsWith: 'cabana buen retiro',
    farm: 'Cabaña Buen Retiro',
    entryDate: null,
  },
  {
    startsWith: 'cabana perales',
    farm: 'Cabaña Perales',
    entryDate: '2025-09-28',
  },
  { startsWith: 'perales', farm: 'Cabaña Perales', entryDate: '2025-01-02' },
  {
    startsWith: 'cabana oro negro',
    farm: 'Cabaña Oro Negro',
    entryDate: '2025-09-28',
  },
  {
    startsWith: 'oro negro',
    farm: 'Cabaña Oro Negro',
    entryDate: '2025-01-02',
  },
  {
    startsWith: 'cabana canaan',
    farm: 'Cabaña Canaan',
    entryDate: '2025-09-28',
  },
  { startsWith: 'cabana el arroyo', farm: 'Cabaña El Arroyo', entryDate: null },
];
/** Textos de esa columna que no son compras: van a observaciones. */
const NOT_PURCHASES = ['cria oro negro', 'esta en buen retiro'];

const EMPTY_REFS = new Set(['', '-', '0', '00']);

/**
 * Lotes de pesaje que no se cargan: la cabaña los revisa y los carga a mano.
 * El del 3/9/2026 da ganancias imposibles contra el del 10/9/2026.
 */
const MANUAL_WEIGHING_DATES = new Set(['2026-09-03']);

/**
 * Días de retiro estándar provisorios: la planilla no los trae. Se pueden
 * corregir producto por producto en el catálogo veterinario.
 */
const STANDARD_WITHDRAWAL_DAYS = 30;

/** Productos de la planilla sanitaria (clave: texto en minúsculas sin tildes). */
const PRODUCTS: Record<
  string,
  {
    name: string;
    category: ProductCategory;
    activeIngredient: string | null;
    doseUnit: DoseUnit | null;
  }
> = {
  'vacuna clostridiosis': {
    name: 'Vacuna clostridiosis',
    category: ProductCategory.VACCINE,
    activeIngredient: null,
    doseUnit: DoseUnit.ML,
  },
  doramectina: {
    name: 'Doramectina',
    category: ProductCategory.INTERNAL_ANTIPARASITIC,
    activeIngredient: 'Doramectina',
    doseUnit: DoseUnit.ML,
  },
  calbendazol: {
    name: 'Calbendazol',
    category: ProductCategory.INTERNAL_ANTIPARASITIC,
    activeIngredient: null,
    doseUnit: DoseUnit.ML,
  },
  olivitasan: {
    name: 'Olivitasan',
    category: ProductCategory.VITAMIN_MINERAL,
    activeIngredient: null,
    doseUnit: DoseUnit.ML,
  },
  selenio: {
    name: 'Selenio',
    category: ProductCategory.VITAMIN_MINERAL,
    activeIngredient: 'Selenio',
    doseUnit: null,
  },
};

/** Observaciones de la planilla sanitaria que no aportan información. */
const IGNORED_HEALTH_NOTES = new Set(['registro sanitario 2026']);
/** Observaciones de la planilla de pesajes que ya quedan en el tipo de pesaje. */
const IGNORED_WEIGHING_NOTES = new Set([
  'peso al nacer',
  'pesaje animales seleccionados',
]);

// ---------------------------------------------------------------------------

interface Row {
  line: number;
  purchase: string;
  earTag: string | null;
  absid: string | null;
  breedKey: string;
  categoryRaw: string;
  sexRaw: string;
  name: string | null;
  colorRaw: string;
  colorKey: string;
  dam: string;
  sire: string;
  birth: string | null;
  weight: number | null;
  statusRaw: string;
  statusDate: string | null;
}

interface Planned {
  row: Row;
  species: Species;
  sex: Sex;
  animal?: Animal;
  notes: string[];
  exceptionReasons: string[];
}

interface EventRow {
  line: number;
  date: string | null;
  ref: string;
  cells: string[];
}

const report: string[] = [];
const section = (title: string) => report.push('', `## ${title}`, '');
const item = (text: string) => report.push(`- ${text}`);
const paragraph = (text: string) => report.push(text, '');
const table = (headers: string[], rows: string[][]) => {
  if (!rows.length) return item('Ninguno.');
  report.push(
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (r) => `| ${r.map((c) => c.replace(/\|/g, '/')).join(' | ')} |`,
    ),
  );
};
const list = (items: string[]) =>
  items.length ? items.forEach(item) : item('Ninguno.');

/** Hallazgos que se vuelcan al reporte al final. */
const findings = {
  omittedDams: [] as string[],
  ambiguousParents: [] as string[],
  adjustedDates: [] as string[],
  damLeftBeforeBirth: [] as string[],
  exitsWithoutDate: [] as string[],
  healthWithoutDate: [] as string[],
  manualWeighings: [] as string[][],
  weighingsAfterExit: [] as string[][],
  skippedEvents: [] as string[][],
  weightWarnings: [] as string[],
  zeroPadded: new Map<string, number>(),
};

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [animalsFile, weighingsFile, healthFile] = args.filter(
    (a) => !a.startsWith('--'),
  );
  if (!animalsFile) {
    throw new Error(
      'Uso: pnpm import:animals <Animales.csv> [Pesaje.csv] [Registro_Sanitario.csv] [--dry-run]',
    );
  }

  const rows = parseAnimals(readCsv(animalsFile));
  const weighingRows = weighingsFile ? parseEvents(readCsv(weighingsFile)) : [];
  const healthRows = healthFile ? parseEvents(readCsv(healthFile)) : [];
  const now = new Date();
  report.push(
    `# Importación de animales — ${dryRun ? 'PRUEBA (no se guardó nada)' : 'IMPORTADO'}`,
    '',
    `Archivos: \`${[animalsFile, weighingsFile, healthFile]
      .filter(Boolean)
      .map((f) => basename(f))
      .join('`, `')}\` · ${now.toISOString()}`,
  );

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const existing = await manager.count(AnimalOrmEntity, {
        withDeleted: true,
      });
      if (existing > 0) {
        throw new Error(
          `La tabla de animales ya tiene ${existing} registros. La importación solo se hace sobre una tabla vacía.`,
        );
      }
      const admin: { id: string }[] = await manager.query(
        `SELECT id FROM users WHERE username = 'admin' AND deleted_at IS NULL`,
      );
      if (!admin[0]) throw new Error('No existe el usuario "admin"');
      const actorId: string = admin[0].id;

      const breeds = await loadBreeds(manager, actorId);
      const colors = await loadColors(manager, actorId);
      const products = healthRows.length
        ? await loadProducts(manager, actorId)
        : new Map<string, VeterinaryProduct>();

      const planned = buildAnimals(rows, breeds, colors, actorId, now);
      const externals = linkParents(planned, actorId, now);
      applyStatuses(planned, now);
      assertNoCycles([...planned.map((p) => p.animal!), ...externals]);

      const finder = animalFinder(planned);
      const weighings = buildWeighings(
        weighingRows,
        planned,
        finder,
        actorId,
        now,
      );
      const healthRecords = buildHealthRecords(
        healthRows,
        finder,
        products,
        actorId,
        now,
      );
      applyNotes(planned, now);

      // Animales: primero sin genealogía y después se enlazan, para no depender del orden.
      const all = [...externals, ...planned.map((p) => p.animal!)];
      const entities = all.map((animal) => AnimalMapper.toOrm(animal));
      const parents = entities.map((e) => ({
        id: e.id,
        dam: e.dam,
        sire: e.sire,
      }));
      for (const entity of entities) {
        entity.dam = null;
        entity.sire = null;
      }
      for (let i = 0; i < entities.length; i += 100) {
        await manager.insert(AnimalOrmEntity, entities.slice(i, i + 100));
      }
      for (const p of parents) {
        if (p.dam || p.sire) {
          await manager.update(
            AnimalOrmEntity,
            { id: p.id },
            { dam: p.dam, sire: p.sire },
          );
        }
      }
      for (let i = 0; i < weighings.length; i += 100) {
        await manager.insert(
          AnimalWeighingOrmEntity,
          weighings.slice(i, i + 100).map((w) => AnimalWeighingMapper.toOrm(w)),
        );
      }
      for (let i = 0; i < healthRecords.length; i += 100) {
        await manager.insert(
          HealthRecordOrmEntity,
          healthRecords
            .slice(i, i + 100)
            .map((r) => HealthRecordMapper.toOrm(r)),
        );
      }

      summarize(planned, externals, weighings, healthRecords);
      if (dryRun) throw new DryRunRollback();
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  } finally {
    await dataSource.destroy();
  }

  const reportFile = join(
    dirname(animalsFile),
    `${basename(animalsFile).replace(/\.[^.]+$/, '')}.reporte${dryRun ? '-prueba' : ''}.md`,
  );
  writeFileSync(reportFile, report.join('\n') + '\n', 'utf8');
  console.log(
    `${dryRun ? 'Prueba completada' : 'Importación completada'}. Reporte: ${reportFile}`,
  );
}

class DryRunRollback extends Error {}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function readCsv(file: string): string {
  const buffer = readFileSync(file);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Excel en Windows exporta en Windows-1252 si no se elige "CSV UTF-8".
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.replace(/^\uFEFF/, '');
}

const clean = (v: string | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();
const orNull = (v: string) => (v === '' ? null : v);
const fold = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
/** "135.00" → "135"; "-" → "". */
const parentRef = (v: string) =>
  v === '-' ? '' : v.replace(/^(\d+)\.0+$/, '$1');

function csvLines(text: string): { line: number; cells: string[] }[] {
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line, index) => ({
      line: index + 2,
      cells: line.split(';').map(clean),
    }))
    .filter((r) => r.cells.some((v) => v !== ''));
}

function parseAnimals(text: string): Row[] {
  const header = text.split(/\r?\n/, 1)[0].toUpperCase();
  if (!header.includes('ARETE') || !header.includes('CATEGORIA')) {
    throw new Error(
      'Animales.csv: encabezado inesperado. Se esperan 14 columnas: compra; arete; ABSID; raza; categoría genética; sexo; nombre; color; madre; padre; nacimiento; peso al nacer; estado; fecha de estado.',
    );
  }
  return csvLines(text).map(({ line, cells: c }) => {
    if (c.length < 14) {
      throw new Error(`Animales, línea ${line}: faltan columnas`);
    }
    const absid = c[2].toUpperCase();
    return {
      line,
      purchase: c[0],
      earTag: orNull(c[1].toUpperCase()),
      absid: absid === '' || absid === 'SN' ? null : absid,
      breedKey: c[3].toUpperCase(),
      categoryRaw: c[4].toUpperCase(),
      sexRaw: c[5],
      name: orNull(c[6]),
      colorRaw: c[7],
      colorKey: fold(c[7]).toUpperCase(),
      dam: parentRef(c[8]),
      sire: parentRef(c[9]),
      birth: parseDate(c[10], `Animales, línea ${line}`),
      weight: parseNumber(c[11], `Animales, línea ${line}`),
      statusRaw: c[12].toUpperCase(),
      statusDate: parseDate(c[13], `Animales, línea ${line}`),
    };
  });
}

/** Pesaje y sanitario: FECHA; ARETE; ... */
function parseEvents(text: string): EventRow[] {
  return csvLines(text).map(({ line, cells }) => ({
    line,
    date: parseDate(cells[0], `Línea ${line}`),
    ref: cells[1].toUpperCase(),
    cells,
  }));
}

function parseDate(value: string, where: string): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = m
    ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    : null;
  if (!iso || new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) !== iso) {
    throw new Error(`${where}: fecha inválida "${value}"`);
  }
  return iso;
}

function parseNumber(value: string, where: string): number | null {
  if (!value || value === '-') return null;
  const n = Number(value.replace(',', '.'));
  if (!Number.isFinite(n))
    throw new Error(`${where}: número inválido "${value}"`);
  return n;
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

async function loadBreeds(manager: EntityManager, actorId: string) {
  const existing = await manager.find(BreedOrmEntity);
  const result = new Map<string, Breed>();
  section('Razas');
  for (const [key, def] of Object.entries(BREEDS)) {
    const found = existing.find(
      (b) => b.species === def.species && fold(b.name) === fold(def.name),
    );
    if (found) {
      result.set(key, BreedMapper.toDomain(found));
      item(`${found.name}: ya existía`);
    } else {
      const breed = Breed.create({ ...def, createdBy: actorId });
      await manager.insert(BreedOrmEntity, BreedMapper.toOrm(breed));
      result.set(key, breed);
      item(`${def.name}: creada`);
    }
  }
  return result;
}

async function loadColors(manager: EntityManager, actorId: string) {
  const existing = await manager.find(AnimalColorOrmEntity);
  const byName = new Map<string, AnimalColor>();
  section('Colores');
  for (const name of new Set(Object.values(COLORS))) {
    const found = existing.find((c) => fold(c.name) === fold(name));
    if (found) {
      byName.set(name, AnimalColorMapper.toDomain(found));
      item(`${found.name}: ya existía`);
    } else {
      const color = AnimalColor.create({ name, createdBy: actorId });
      await manager.insert(
        AnimalColorOrmEntity,
        AnimalColorMapper.toOrm(color),
      );
      byName.set(name, color);
      item(`${name}: creado`);
    }
  }
  return byName;
}

async function loadProducts(manager: EntityManager, actorId: string) {
  const existing = await manager.find(VeterinaryProductOrmEntity);
  const result = new Map<string, VeterinaryProduct>();
  section('Productos veterinarios');
  for (const [key, def] of Object.entries(PRODUCTS)) {
    const found = existing.find((p) => fold(p.name) === fold(def.name));
    if (found) {
      result.set(key, VeterinaryProductMapper.toDomain(found));
      item(
        `${found.name}: ya existía (retiro de carne: ${found.meatWithdrawalDays} días)`,
      );
    } else {
      const product = VeterinaryProduct.create({
        ...def,
        meatWithdrawalDays: STANDARD_WITHDRAWAL_DAYS,
        notes: `Días de retiro estándar (${STANDARD_WITHDRAWAL_DAYS}) cargados al importar la planilla: verifique el prospecto y corríjalos si corresponde.`,
        createdBy: actorId,
      });
      await manager.insert(
        VeterinaryProductOrmEntity,
        VeterinaryProductMapper.toOrm(product),
      );
      result.set(key, product);
      item(
        `${def.name}: creado con retiro de carne estándar de ${STANDARD_WITHDRAWAL_DAYS} días`,
      );
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Animales
// ---------------------------------------------------------------------------

const label = (p: Planned) =>
  `L${p.row.line} ${p.row.earTag ?? '(sin arete)'}${p.row.name ? ` ${p.row.name}` : ''}`;

function buildAnimals(
  rows: Row[],
  breeds: Map<string, Breed>,
  colors: Map<string, AnimalColor>,
  actorId: string,
  now: Date,
): Planned[] {
  const seenTags = new Map<string, number>();
  const seenAbsid = new Map<string, number>();

  return rows.map((row) => {
    const breed = breeds.get(row.breedKey);
    if (!breed)
      throw new Error(`Línea ${row.line}: raza desconocida "${row.breedKey}"`);
    const species = breed.getSpecies();
    const sex = /^H/i.test(row.sexRaw) ? Sex.FEMALE : Sex.MALE;
    const notes: string[] = [];
    const exceptionReasons: string[] = [];
    const planned: Planned = { row, species, sex, notes, exceptionReasons };

    if (/REPROD/i.test(row.sexRaw))
      notes.push('Reproductor (según la planilla).');
    if (row.weight !== null && !row.birth) {
      notes.push(
        `Peso al nacer según la planilla: ${row.weight} kg (sin fecha de nacimiento).`,
      );
    }

    if (!(row.categoryRaw in GENETIC_CATEGORIES)) {
      throw new Error(
        `Línea ${row.line}: categoría genética sin mapear "${row.categoryRaw}"`,
      );
    }

    // Color
    let color: AnimalColor | null = null;
    if (row.colorKey) {
      const colorName = COLORS[row.colorKey];
      if (!colorName)
        throw new Error(
          `Línea ${row.line}: color sin mapear "${row.colorKey}"`,
        );
      color = colors.get(colorName)!;
      if (APPROXIMATE_COLORS.has(row.colorKey)) {
        notes.push(`Color en la planilla: ${row.colorRaw.toLowerCase()}.`);
      }
    }

    // Origen
    let entryOrigin: EntryOrigin;
    let entryDate: string | null = null;
    let sourceFarm: string | null = null;
    const purchaseKey = fold(row.purchase);
    const purchase = PURCHASES.find((p) =>
      purchaseKey.startsWith(p.startsWith),
    );
    if (purchase) {
      entryOrigin = EntryOrigin.PURCHASE;
      sourceFarm = purchase.farm;
      entryDate = purchase.entryDate;
      if (purchaseKey !== fold(purchase.farm)) {
        notes.push(`Compra (planilla): ${row.purchase}.`);
      }
    } else {
      if (row.purchase) {
        if (!NOT_PURCHASES.some((p) => purchaseKey.startsWith(p))) {
          throw new Error(
            `Línea ${row.line}: compra sin mapear "${row.purchase}"`,
          );
        }
        notes.push(`Planilla: ${row.purchase}.`);
      }
      entryOrigin = row.birth
        ? EntryOrigin.BORN_ON_FARM
        : EntryOrigin.INITIAL_STOCK;
    }

    // Identificadores: únicos por especie; los repetidos y los faltantes son casos especiales
    if (!row.earTag)
      exceptionReasons.push('sin arete registrado en la planilla');
    if (row.earTag) {
      const key = `${species}|${row.earTag}`;
      if (seenTags.has(key)) {
        exceptionReasons.push(
          `arete ${row.earTag} repetido (también en la línea ${seenTags.get(key)} de la planilla)`,
        );
      } else seenTags.set(key, row.line);
    }
    if (row.absid) {
      const key = `${species}|${row.absid}`;
      if (seenAbsid.has(key)) {
        exceptionReasons.push(
          `ABSID ${row.absid} repetido (también en la línea ${seenAbsid.get(key)} de la planilla)`,
        );
      } else seenAbsid.set(key, row.line);
    }

    // Estado
    if (!STATUSES[row.statusRaw])
      throw new Error(
        `Línea ${row.line}: estado sin mapear "${row.statusRaw}"`,
      );
    if (row.statusRaw === 'RESERVADO')
      notes.push('Reservado (según la planilla).');
    if (STATUSES[row.statusRaw] !== AnimalStatus.ALIVE && !row.statusDate) {
      notes.push('Fecha de salida no registrada en la planilla.');
      findings.exitsWithoutDate.push(`${label(planned)}: ${row.statusRaw}`);
    }
    // Salida anterior al nacimiento: se registra el día del nacimiento.
    if (row.statusDate && row.birth && row.statusDate < row.birth) {
      notes.push(
        `Según la planilla nació el ${row.birth} y la salida (${row.statusRaw.toLowerCase()}) fue el ${row.statusDate}: se registró la salida el día del nacimiento.`,
      );
      findings.adjustedDates.push(
        `${label(planned)}: nacimiento ${row.birth}, salida (${row.statusRaw.toLowerCase()}) ${row.statusDate} → se registró la salida el ${row.birth}.`,
      );
      row.statusDate = row.birth;
    }

    try {
      planned.animal = Animal.create({
        isExternal: false,
        earTag: row.earTag,
        name: row.name,
        species,
        breed,
        sex,
        color,
        geneticCategory: GENETIC_CATEGORIES[row.categoryRaw],
        absidRegistry: row.absid,
        identifierException: exceptionReasons.length > 0,
        identifierExceptionReason:
          exceptionReasons.length > 0
            ? `Importado de la planilla: ${exceptionReasons.join('; ')}`.slice(
                0,
                500,
              )
            : null,
        birthDate: row.birth,
        entryOrigin,
        entryDate,
        sourceFarm,
        notes: null,
        createdBy: actorId,
        now,
      });
    } catch (error) {
      throw new Error(
        `Línea ${row.line} (arete ${row.earTag ?? '-'}): ${(error as Error).message}`,
      );
    }
    return planned;
  });
}

// ---------------------------------------------------------------------------
// Genealogía
// ---------------------------------------------------------------------------

const strip = (v: string) => v.replace(/^0+(?=\d)/, '');
/** "B-272" en la columna de padres equivale al ABSID "272-B". */
const variants = (ref: string) => {
  const r = ref.toUpperCase();
  const m = r.match(/^B-(.+)$/);
  return m ? [r, `${m[1]}-B`] : [r];
};
const matchesRef = (p: Planned, refs: string[]) =>
  [p.row.absid, p.row.earTag].some(
    (id) => id && refs.some((r) => strip(r) === strip(id)),
  );

function linkParents(planned: Planned[], actorId: string, now: Date): Animal[] {
  const externals = new Map<string, { animal: Animal; children: number }>();
  const resolved = {
    byAbsid: 0,
    byTag: 0,
    external: 0,
    ambiguous: 0,
    omitted: 0,
  };

  const resolve = (
    child: Planned,
    ref: string,
    want: Sex,
  ): Planned | 'external' | Planned[] => {
    const childBirth = child.row.birth;
    const pool = planned.filter(
      (p) =>
        p !== child &&
        p.species === child.species &&
        p.sex === want &&
        !(p.row.birth && childBirth && p.row.birth >= childBirth),
    );
    const refs = variants(ref);
    const levels: Planned[][] = [
      pool.filter((p) => p.row.absid && refs.includes(p.row.absid)),
      pool.filter((p) => p.row.earTag && refs.includes(p.row.earTag)),
      pool.filter(
        (p) =>
          p.row.absid && refs.some((r) => strip(r) === strip(p.row.absid!)),
      ),
      pool.filter(
        (p) =>
          p.row.earTag && refs.some((r) => strip(r) === strip(p.row.earTag!)),
      ),
    ];
    for (const [level, list] of levels.entries()) {
      if (list.length === 1) {
        if (level % 2 === 0) resolved.byAbsid++;
        else resolved.byTag++;
        return list[0];
      }
      if (list.length > 1) {
        // Desempate: el animal que ya estaba en la cabaña cuando nació la cría.
        const inFarm = list.filter(
          (p) =>
            !childBirth ||
            p.animal!.getEntryOrigin() !== EntryOrigin.PURCHASE ||
            (p.animal!.getEntryDate() !== null &&
              p.animal!.getEntryDate()! <= childBirth),
        );
        if (inFarm.length === 1) {
          resolved.byAbsid++;
          return inFarm[0];
        }
        return list;
      }
    }
    return 'external';
  };

  const externalFor = (child: Planned, ref: string, sex: Sex): Animal => {
    const key = `${child.species}|${sex}|${ref.toUpperCase()}`;
    const found = externals.get(key);
    if (found) {
      found.children++;
      return found.animal;
    }
    const isName = /[a-z]{3,}/i.test(ref) && !/^[A-Z]-?\d/i.test(ref);
    const animal = Animal.create({
      isExternal: true,
      name: isName ? ref : null,
      externalRegistry: isName ? null : ref.toUpperCase(),
      species: child.species,
      breed: child.animal!.getBreed(),
      sex,
      notes: `Creado al importar la planilla: figura como ${sex === Sex.FEMALE ? 'madre' : 'padre'} con la referencia "${ref}", pero ese animal no está en la planilla. Complete sus datos si los conoce.`,
      createdBy: actorId,
      now,
    });
    externals.set(key, { animal, children: 1 });
    return animal;
  };

  const describe = (p: Planned, child: Planned) => {
    const reasons: string[] = [];
    if (p.sex !== Sex.FEMALE) reasons.push('es macho');
    if (p.row.birth && child.row.birth && p.row.birth >= child.row.birth)
      reasons.push(`nació el ${p.row.birth}, después que la cría`);
    return `arete ${p.row.earTag ?? '-'} ${p.row.name ?? ''} (${reasons.join(' y ')})`.replace(
      /\s+\(/,
      ' (',
    );
  };

  for (const child of planned) {
    const changes: { dam?: AnimalParent; sire?: AnimalParent } = {};
    for (const [role, ref, sex] of [
      ['dam', child.row.dam, Sex.FEMALE],
      ['sire', child.row.sire, Sex.MALE],
    ] as const) {
      if (EMPTY_REFS.has(ref)) continue;
      const result = resolve(child, ref, sex);
      const roleLabel = role === 'dam' ? 'Madre' : 'Padre';
      if (result === 'external') {
        // Madre imposible: el número es de un animal de la planilla, pero macho
        // o nacido después de la cría. Se deja sin madre para corregir a mano.
        const impossible =
          role === 'dam'
            ? planned.filter(
                (p) =>
                  p !== child &&
                  p.species === child.species &&
                  matchesRef(p, variants(ref)),
              )
            : [];
        if (impossible.length) {
          resolved.omitted++;
          const why = impossible.map((p) => describe(p, child)).join('; ');
          child.notes.push(
            `Madre según la planilla: "${ref}", pero ese número corresponde a ${why}. Se dejó sin madre: asígnela a mano.`,
          );
          findings.omittedDams.push(`${label(child)}: madre "${ref}" → ${why}`);
          continue;
        }
        resolved.external++;
        changes[role] = externalFor(child, ref, sex).toParent();
      } else if (Array.isArray(result)) {
        resolved.ambiguous++;
        child.notes.push(
          `${roleLabel} según la planilla: "${ref}" (no se pudo determinar: ${result.map((p) => `arete ${p.row.earTag ?? '-'}`).join(' o ')}).`,
        );
        findings.ambiguousParents.push(
          `${label(child)}: ${roleLabel.toLowerCase()} "${ref}" → ${result.map((p) => `arete ${p.row.earTag ?? '-'} ${p.row.name ?? ''} (ABSID ${p.row.absid ?? '-'})`).join(' o ')}`,
        );
      } else {
        changes[role] = result.animal!.toParent();
        const left = STATUSES[result.row.statusRaw] !== AnimalStatus.ALIVE;
        if (
          role === 'dam' &&
          left &&
          result.row.statusDate &&
          child.row.birth &&
          result.row.statusDate < child.row.birth
        ) {
          findings.damLeftBeforeBirth.push(
            `${label(child)} (nació ${child.row.birth}): su madre ${label(result)} figura ${result.row.statusRaw.toLowerCase()} el ${result.row.statusDate}. Se enlazó igual (¿vendida y todavía no retirada?).`,
          );
        }
      }
    }
    if (changes.dam || changes.sire) {
      try {
        child.animal!.update(changes, now);
      } catch (error) {
        throw new Error(
          `Línea ${child.row.line} (arete ${child.row.earTag ?? '-'}): ${(error as Error).message}`,
        );
      }
    }
  }

  section('Genealogía');
  item(
    `Enlazadas con un animal de la planilla: ${resolved.byAbsid + resolved.byTag} (${resolved.byAbsid} por ABSID, ${resolved.byTag} por arete)`,
  );
  item(`Enlazadas con un reproductor externo nuevo: ${resolved.external}`);
  item(
    `Sin enlazar por ambigüedad (anotadas en las observaciones de la cría): ${resolved.ambiguous}`,
  );
  item(
    `Madres imposibles omitidas (anotadas en las observaciones de la cría): ${resolved.omitted}`,
  );
  section(`Reproductores externos creados (${externals.size})`);
  for (const { animal, children } of externals.values()) {
    item(
      `${animal.getSex() === Sex.FEMALE ? 'Hembra' : 'Macho'} ${animal.getSpecies() === Species.SHEEP ? 'ovino' : 'caprino'} "${animal.getExternalRegistry() ?? animal.getName()}" — ${children} cría(s)`,
    );
  }
  return [...externals.values()].map((e) => e.animal);
}

// ---------------------------------------------------------------------------
// Estado y observaciones
// ---------------------------------------------------------------------------

function applyStatuses(planned: Planned[], now: Date) {
  for (const p of planned) {
    const status = STATUSES[p.row.statusRaw];
    if (status === AnimalStatus.ALIVE) continue;
    try {
      p.animal!.recordHistoricalStatus(
        { status, date: p.row.statusDate, reason: null },
        now,
      );
    } catch (error) {
      throw new Error(
        `Línea ${p.row.line} (arete ${p.row.earTag ?? '-'}): ${(error as Error).message}`,
      );
    }
  }
}

function applyNotes(planned: Planned[], now: Date) {
  for (const p of planned) {
    if (!p.notes.length) continue;
    p.animal!.update({ notes: p.notes.join('\n').slice(0, 1000) }, now);
  }
}

// ---------------------------------------------------------------------------
// Pesajes y sanitario: búsqueda del animal por arete
// ---------------------------------------------------------------------------

type Finder = (ref: string) => { planned: Planned } | { error: string };

/**
 * La columna "ARETE o ABSID" trae el arete. Si no aparece tal cual, se prueba
 * sin los ceros a la izquierda que Excel borra ("239" → "00239").
 */
function animalFinder(planned: Planned[]): Finder {
  return (ref) => {
    if (!ref) return { error: 'sin arete' };
    const exact = planned.filter((p) => p.row.earTag === ref);
    if (exact.length === 1) return { planned: exact[0] };
    if (exact.length > 1) {
      return {
        error: `arete repetido: ${exact.map(label).join(', ')}`,
      };
    }
    const padded = planned.filter(
      (p) => p.row.earTag && strip(p.row.earTag) === strip(ref),
    );
    if (padded.length === 1) {
      const tag = padded[0].row.earTag!;
      const key = `${ref} → ${tag}`;
      findings.zeroPadded.set(key, (findings.zeroPadded.get(key) ?? 0) + 1);
      return { planned: padded[0] };
    }
    if (padded.length > 1) {
      return {
        error: `arete ambiguo: ${padded.map(label).join(', ')}`,
      };
    }
    return { error: 'no hay ningún animal con ese arete' };
  };
}

const exitDateOf = (p: Planned) =>
  STATUSES[p.row.statusRaw] !== AnimalStatus.ALIVE ? p.row.statusDate : null;

function buildWeighings(
  rows: EventRow[],
  planned: Planned[],
  find: Finder,
  actorId: string,
  now: Date,
): AnimalWeighing[] {
  const result: AnimalWeighing[] = [];
  const byAnimal = new Map<Planned, AnimalWeighing[]>();
  const hasType = (p: Planned, type: WeighingType) =>
    (byAnimal.get(p) ?? []).some((w) => w.getType() === type);
  const add = (p: Planned, w: AnimalWeighing) => {
    result.push(w);
    byAnimal.set(p, [...(byAnimal.get(p) ?? []), w]);
  };
  const skip = (row: EventRow, reason: string) =>
    findings.skippedEvents.push([
      'Pesaje',
      `L${row.line}`,
      row.cells[0],
      row.ref || '(vacío)',
      row.cells.slice(2).filter(Boolean).join(' · '),
      reason,
    ]);

  for (const row of rows) {
    const [, , motive, kgRaw, obs] = row.cells;
    const found = find(row.ref);
    if ('error' in found) {
      skip(row, found.error);
      continue;
    }
    const p = found.planned;
    if (!row.date) {
      skip(row, 'sin fecha');
      continue;
    }
    if (MANUAL_WEIGHING_DATES.has(row.date)) {
      findings.manualWeighings.push([
        row.cells[0],
        p.row.earTag ?? '-',
        p.row.name ?? '-',
        motive,
        kgRaw,
        obs ?? '',
        `L${row.line}`,
      ]);
      continue;
    }
    const exit = exitDateOf(p);
    if (exit && row.date > exit) {
      findings.weighingsAfterExit.push([
        `L${row.line}`,
        `${p.row.earTag} ${p.row.name ?? ''}`,
        row.cells[0],
        `${kgRaw} kg`,
        `${p.row.statusRaw.toLowerCase()} el ${exit}`,
      ]);
      continue;
    }

    const notes: string[] = [];
    let type: WeighingType;
    const motiveKey = fold(motive ?? '');
    if (motiveKey === 'nacimiento') type = WeighingType.BIRTH;
    else if (motiveKey === 'destete') type = WeighingType.WEANING;
    else if (motiveKey === 'pesaje')
      type = /seleccionad/i.test(obs ?? '')
        ? WeighingType.SELECTION
        : WeighingType.ROUTINE;
    else
      throw new Error(
        `Pesaje, línea ${row.line}: motivo sin mapear "${motive}"`,
      );
    if (
      (type === WeighingType.BIRTH || type === WeighingType.WEANING) &&
      hasType(p, type)
    ) {
      notes.push(
        `En la planilla figura como ${motive.toLowerCase()}, pero el animal ya tiene uno: se cargó como pesaje de control.`,
      );
      type = WeighingType.ROUTINE;
    }
    if (obs && !IGNORED_WEIGHING_NOTES.has(fold(obs))) notes.push(obs);

    const weightKg = parseNumber(kgRaw, `Pesaje, línea ${row.line}`);
    if (weightKg === null) {
      skip(row, 'sin peso');
      continue;
    }
    try {
      add(
        p,
        AnimalWeighing.create({
          animal: p.animal!,
          data: {
            weighedAt: row.date,
            weightKg,
            type,
            notes: notes.join(' ') || null,
          },
          createdBy: actorId,
          now,
        }),
      );
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      skip(row, `rechazado: ${error.message}`);
    }
  }

  // Peso al nacer de Animales.csv cuando la planilla de pesajes no lo trae.
  let fromAnimals = 0;
  for (const p of planned) {
    if (p.row.weight === null || !p.row.birth) continue;
    if (hasType(p, WeighingType.BIRTH)) continue;
    try {
      add(
        p,
        AnimalWeighing.create({
          animal: p.animal!,
          data: {
            weighedAt: p.row.birth,
            weightKg: p.row.weight,
            type: WeighingType.BIRTH,
          },
          createdBy: actorId,
          now,
        }),
      );
      fromAnimals++;
    } catch (error) {
      throw new Error(
        `Línea ${p.row.line} (arete ${p.row.earTag ?? '-'}), peso al nacer: ${(error as Error).message}`,
      );
    }
  }

  // Alertas (se cargan igual): bajadas fuertes o ganancias imposibles.
  for (const [p, list] of byAnimal) {
    const sorted = [...list].sort((a, b) =>
      a.getWeighedAt().localeCompare(b.getWeighedAt()),
    );
    sorted.forEach((w, i) => {
      for (const warning of weighingWarnings(w, sorted[i - 1] ?? null)) {
        findings.weightWarnings.push(
          `${label(p)}, pesaje del ${w.getWeighedAt()} (${w.getWeightKg()} kg): ${warning}`,
        );
      }
    });
  }

  section('Pesajes');
  item(`Filas en la planilla: ${rows.length}`);
  item(`Cargados desde la planilla de pesajes: ${result.length - fromAnimals}`);
  item(`Pesos al nacer tomados de Animales.csv: ${fromAnimals}`);
  return result;
}

interface PlannedRecord {
  type: HealthEventType;
  productKey: string | null;
  data: Partial<HealthRecordData>;
  notes: string[];
}

/** "2 ml" → { 2, ML }; cualquier otra forma va a observaciones. */
function parseDose(text: string): { quantity: number; unit: DoseUnit } | null {
  const m = text.match(/^(\d+(?:[.,]\d+)?)\s*ml$/i);
  return m
    ? { quantity: Number(m[1].replace(',', '.')), unit: DoseUnit.ML }
    : null;
}

/** Interpreta una fila de la planilla sanitaria en uno o más eventos. */
function interpretHealth(row: EventRow): PlannedRecord[] {
  const [, , typeRaw, productRaw = '', doseRaw = ''] = row.cells;
  const type = fold(typeRaw);
  const product = fold(productRaw);
  const where = `Sanitario, línea ${row.line}`;

  // Productos combinados ("Doramectina + Olivitasan"): un evento por producto.
  const combined = (eventType: HealthEventType): PlannedRecord[] => {
    const names = product
      .replace(/\(.*?\)/g, '')
      .split('+')
      .map((s) => s.trim());
    const general = /\(desparasitacion general\)/.test(product)
      ? ['Desparasitación general.']
      : [];
    return names.map((name, index) => {
      const key = Object.keys(PRODUCTS).find((k) => name.startsWith(k));
      if (!key) throw new Error(`${where}: producto sin mapear "${name}"`);
      const isVitamin =
        PRODUCTS[key].category === ProductCategory.VITAMIN_MINERAL;
      // "2 ml calbendazol + 2 ml olivitasan" → la dosis de cada uno.
      const perProduct = doseRaw
        .split('+')
        .map((s) => s.trim())
        .find((s) => fold(s).includes(key));
      const dose =
        parseDose(perProduct?.replace(new RegExp(key, 'i'), '').trim() ?? '') ??
        (names.length === 1 ? parseDose(doseRaw) : null);
      const notes = [...general];
      if (!dose && doseRaw && index === 0) notes.push(`Dosis: ${doseRaw}.`);
      if (names.length > 1) {
        notes.push(
          `Aplicado junto con ${names
            .filter((n) => n !== name)
            .map(
              (n) =>
                PRODUCTS[Object.keys(PRODUCTS).find((k) => n.startsWith(k))!]
                  .name,
            )
            .join(', ')}.`,
        );
      }
      return {
        type: isVitamin ? HealthEventType.VITAMINS_MINERALS : eventType,
        productKey: key,
        data: dose ? { doseQuantity: dose.quantity, doseUnit: dose.unit } : {},
        notes,
      };
    });
  };

  if (type === 'vacuna') {
    return combined(HealthEventType.VACCINATION).map((r) => ({
      ...r,
      data: {
        ...r.data,
        targetCondition: /clostrid/.test(product) ? 'Clostridiosis' : null,
      },
    }));
  }
  if (type === 'desparasitacion')
    return combined(HealthEventType.INTERNAL_DEWORMING);
  if (type.startsWith('vitamina')) {
    // Producto conocido (p. ej. "Selenio").
    if (Object.keys(PRODUCTS).some((k) => product.startsWith(k))) {
      return combined(HealthEventType.VITAMINS_MINERALS);
    }
    // "Vitamina + mineral + desparasitacion": dos aplicaciones, sin producto registrado.
    const notes = [`Planilla: ${productRaw} (producto no registrado).`];
    const records: PlannedRecord[] = [
      {
        type: HealthEventType.VITAMINS_MINERALS,
        productKey: null,
        data: {},
        notes,
      },
    ];
    if (product.includes('desparasit')) {
      records.push({
        type: HealthEventType.INTERNAL_DEWORMING,
        productKey: null,
        data: {},
        notes,
      });
    }
    return records;
  }
  if (type === 'tratamiento') {
    const dose = parseDose(doseRaw);
    const doseData = dose
      ? { doseQuantity: dose.quantity, doseUnit: dose.unit }
      : {};
    const notes = [
      productRaw + (doseRaw && !dose ? ` (${doseRaw})` : '') + '.',
    ];
    if (/casque|recorte de pesu/.test(product))
      return [
        {
          type: HealthEventType.HOOF_TRIMMING,
          productKey: null,
          data: {},
          notes,
        },
      ];
    if (/neumon/.test(product))
      return [
        {
          type: HealthEventType.TREATMENT,
          productKey: null,
          data: { ...doseData, targetCondition: 'Neumonía' },
          notes,
        },
      ];
    if (/resfr/.test(product))
      return [
        {
          type: HealthEventType.TREATMENT,
          productKey: null,
          data: { ...doseData, targetCondition: 'Resfrío' },
          notes,
        },
      ];
    if (/selenio/.test(product))
      return [
        {
          type: HealthEventType.VITAMINS_MINERALS,
          productKey: 'selenio',
          data: doseData,
          notes: [],
        },
      ];
    if (/absceso/.test(product))
      return [
        {
          type: HealthEventType.OTHER_PROCEDURE,
          productKey: null,
          data: { targetCondition: 'Absceso' },
          notes,
        },
      ];
    if (/herida/.test(product))
      return [
        {
          type: HealthEventType.OTHER_PROCEDURE,
          productKey: null,
          data: { targetCondition: productRaw },
          notes: [],
        },
      ];
  }
  throw new Error(
    `${where}: tipo o detalle sin mapear "${typeRaw}" / "${productRaw}"`,
  );
}

function buildHealthRecords(
  rows: EventRow[],
  find: Finder,
  products: Map<string, VeterinaryProduct>,
  actorId: string,
  now: Date,
): HealthRecord[] {
  const result: HealthRecord[] = [];
  const skip = (row: EventRow, reason: string) =>
    findings.skippedEvents.push([
      'Sanitario',
      `L${row.line}`,
      row.cells[0] || '(sin fecha)',
      row.ref || '(vacío)',
      row.cells.slice(2).filter(Boolean).join(' · '),
      reason,
    ]);

  for (const row of rows) {
    const obs = row.cells[5] ?? '';
    const found = find(row.ref);
    if ('error' in found) {
      skip(row, found.error);
      continue;
    }
    const p = found.planned;
    const planned = interpretHealth(row);

    // Sin fecha: no se crea el evento; queda en las observaciones del animal.
    if (!row.date) {
      const detail = [row.cells[3], row.cells[4]].filter(Boolean).join(', ');
      p.notes.push(
        `${row.cells[2]}: ${detail} — fecha no registrada en la planilla.`,
      );
      findings.healthWithoutDate.push(
        `${label(p)}: ${row.cells[2]} — ${detail}`,
      );
      continue;
    }
    const exit = exitDateOf(p);
    if (exit && row.date > exit) {
      skip(
        row,
        `posterior a la salida (${p.row.statusRaw.toLowerCase()} el ${exit})`,
      );
      continue;
    }
    let appliedAt = row.date;
    const extraNotes: string[] = [];
    // Anterior al nacimiento: se registra el día del nacimiento, como fecha estimada.
    if (p.row.birth && row.date < p.row.birth) {
      appliedAt = p.row.birth;
      extraNotes.push(
        `En la planilla figura el ${row.date}, antes del nacimiento (${p.row.birth}): se registró el día del nacimiento.`,
      );
      findings.adjustedDates.push(
        `Registro sanitario, línea ${row.line} (animal ${label(p)}): ${row.cells[2]} el ${row.date}, pero nació el ${p.row.birth} → se registró el ${p.row.birth} como fecha estimada.`,
      );
    }
    if (obs && !IGNORED_HEALTH_NOTES.has(fold(obs))) extraNotes.push(`${obs}.`);

    for (const r of planned) {
      try {
        result.push(
          HealthRecord.create({
            animal: p.animal!,
            product: r.productKey ? products.get(r.productKey)! : null,
            data: {
              ...r.data,
              type: r.type,
              appliedAt,
              isDateEstimated: appliedAt !== row.date,
              notes: [...r.notes, ...extraNotes].join(' ') || null,
            },
            createdBy: actorId,
            now,
          }),
        );
      } catch (error) {
        if (!(error instanceof DomainError)) throw error;
        skip(row, `rechazado: ${error.message}`);
      }
    }
  }

  section('Registro sanitario');
  item(`Filas en la planilla: ${rows.length}`);
  item(
    `Eventos creados: ${result.length} (los productos combinados, como "Doramectina + Olivitasan", generan un evento por producto)`,
  );
  return result;
}

function assertNoCycles(animals: Animal[]) {
  const byId = new Map(animals.map((a) => [a.getId(), a]));
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (a: Animal) => {
    if (done.has(a.getId())) return;
    if (visiting.has(a.getId())) {
      throw new Error(
        `Ciclo en la genealogía en el animal ${a.getEarTag() ?? a.getId()}`,
      );
    }
    visiting.add(a.getId());
    for (const parent of [a.getDam(), a.getSire()]) {
      if (parent) visit(byId.get(parent.id)!);
    }
    visiting.delete(a.getId());
    done.add(a.getId());
  };
  animals.forEach(visit);
}

// ---------------------------------------------------------------------------
// Reporte
// ---------------------------------------------------------------------------

function summarize(
  planned: Planned[],
  externals: Animal[],
  weighings: AnimalWeighing[],
  healthRecords: HealthRecord[],
) {
  const count = <T>(values: T[]) =>
    values.reduce(
      (m, v) => m.set(v, (m.get(v) ?? 0) + 1),
      new Map<T, number>(),
    );

  section('Resumen');
  item(`Animales de la cabaña: ${planned.length}`);
  item(`Reproductores externos: ${externals.length}`);
  for (const [status, n] of count(planned.map((p) => p.animal!.getStatus()))) {
    item(`Estado ${status}: ${n}`);
  }
  for (const [origin, n] of count(
    planned.map((p) => p.animal!.getEntryOrigin()),
  )) {
    item(`Origen ${origin}: ${n}`);
  }
  item(`Pesajes cargados: ${weighings.length}`);
  item(`Eventos sanitarios cargados: ${healthRecords.length}`);
  item(
    `Pesajes para cargar a mano (lotes ${[...MANUAL_WEIGHING_DATES].join(', ')}): ${findings.manualWeighings.length}`,
  );
  item(
    `Pesajes posteriores a la salida (no cargados): ${findings.weighingsAfterExit.length}`,
  );
  item(`Otras filas no cargadas: ${findings.skippedEvents.length}`);

  section('1. Lote de pesajes para cargar a mano');
  paragraph(
    `No se cargó ningún pesaje del ${[...MANUAL_WEIGHING_DATES].join(', ')}: contra el pesaje de la semana siguiente dan ganancias imposibles (5 a 7 kg en una semana). Revise los pesos y cárguelos a mano desde la ficha de cada animal.`,
  );
  table(
    ['Fecha', 'Arete', 'Nombre', 'Motivo', 'Peso (kg)', 'Observación', 'Línea'],
    findings.manualWeighings,
  );

  section('2. Pesajes posteriores a la salida del animal (no cargados)');
  paragraph(
    'El sistema no acepta pesajes posteriores a la venta o la muerte. Si el animal se vendió pero seguía en la cabaña, corrija la fecha de salida al día en que se lo llevaron y cargue estos pesajes a mano.',
  );
  table(
    ['Línea', 'Animal', 'Fecha del pesaje', 'Peso', 'Salida'],
    findings.weighingsAfterExit,
  );

  section('3. Madres imposibles (se dejaron sin madre)');
  paragraph(
    'El número de la madre corresponde a un macho o a un animal nacido después de la cría. Quedó anotado en las observaciones del animal: asigne la madre correcta a mano.',
  );
  list(findings.omittedDams);

  section('4. ABSID y aretes repetidos (casos especiales)');
  paragraph(
    'Se cargaron como "caso especial" (identifierException). Revise si alguno es un error de tipeo. En los animales comprados, el ABSID repetido suele ser el número de la otra cabaña.',
  );
  list(
    planned
      .filter((p) => p.exceptionReasons.length)
      .map((p) => `${label(p)}: ${p.exceptionReasons.join('; ')}`),
  );
  report.push('', '### Madres o padres ambiguos (por los repetidos)', '');
  paragraph(
    'Hay más de un animal con ese número. Quedó anotado en las observaciones de la cría: asígnelo a mano.',
  );
  list(findings.ambiguousParents);

  section('5. Fechas imposibles (cargadas con ajuste)');
  list(findings.adjustedDates);
  report.push(
    '',
    '### Madre que ya había salido cuando nació la cría (enlazada igual)',
    '',
  );
  list(findings.damLeftBeforeBirth);

  section('6. Salidas sin fecha');
  paragraph(
    'Se cargaron sin fecha, con la nota "Fecha de salida no registrada en la planilla". Complétela si se conoce.',
  );
  list(findings.exitsWithoutDate);

  section('7. Tratamientos sin fecha (en observaciones)');
  paragraph(
    'El registro sanitario exige una fecha: estos tratamientos quedaron en las observaciones del animal. Si se conoce la fecha, cárguelos a mano.',
  );
  list(findings.healthWithoutDate);

  section('8. Otras filas no cargadas');
  table(
    ['Planilla', 'Línea', 'Fecha', 'Arete', 'Detalle', 'Motivo'],
    findings.skippedEvents,
  );

  section('9. Aretes completados con ceros (planilla sanitaria)');
  list(
    [...findings.zeroPadded].map(
      ([k, n]) => `${k} (${n} fila${n > 1 ? 's' : ''})`,
    ),
  );

  section('10. Alertas de peso (cargados igual)');
  paragraph(
    'Bajadas de más del 15 % o ganancias de más de 600 g/día. Suelen ser errores de tipeo: verifíquelos.',
  );
  list(findings.weightWarnings);

  section('11. Compras sin fecha de ingreso');
  list(
    planned
      .filter(
        (p) =>
          p.animal!.getEntryOrigin() === EntryOrigin.PURCHASE &&
          !p.animal!.getEntryDate(),
      )
      .map((p) => `${label(p)}: ${p.animal!.getSourceFarm()}`),
  );

  section('12. Otros puntos para revisar');
  list([
    ...planned
      .filter((p) => /^(CRS|CSRR)-/.test(p.row.earTag ?? ''))
      .map(
        (p) =>
          `${label(p)}: arete "${p.row.earTag}" (¿error de tipeo de CSR-?); se importó tal cual.`,
      ),
    ...planned
      .filter((p) => APPROXIMATE_COLORS.has(p.row.colorKey))
      .map(
        (p) =>
          `${label(p)}: color "${p.row.colorRaw.toLowerCase()}" → ${p.animal!.getColor()?.getName()}.`,
      ),
    `Productos veterinarios nuevos: retiro de carne estándar de ${STANDARD_WITHDRAWAL_DAYS} días (la planilla no lo trae). Verifíquelo con el prospecto de cada producto.`,
  ]);
}

main().catch((error) => {
  console.error(`\nERROR: ${(error as Error).message}\nNo se guardó nada.`);
  process.exit(1);
});
