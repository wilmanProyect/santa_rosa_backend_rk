import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

/**
 * Avisos de revisión con las diferencias encontradas al cruzar la planilla de
 * montas (Produccion.csv) con los datos del sistema, más los partos de una
 * misma madre demasiado cercanos. Cada aviso se muestra en la ficha de los
 * animales y partos involucrados hasta que el personal lo marca como corregido.
 *
 * Los registros se buscan por arete (animales de la cabaña), por registro
 * externo (animales externos) o por la cría (partos). Lo que no se encuentra se
 * omite, y un aviso sin ningún registro no se crea: en una base sin estos datos
 * la migración no inserta nada.
 */

/** A: animal de la cabaña por arete · X: animal externo por registro · B: parto de la cría con ese arete. */
type Ref = ['A' | 'X' | 'B', string, string];

interface Seed {
  category: 'PARENTAGE' | 'MISSING_RECORD' | 'DATES' | 'IDENTIFIER';
  message: string;
  targets: Ref[];
  source?: string;
}

const SHEET = 'Planilla de montas (Produccion.csv), cruzada el 11/11/2026';
const SYSTEM = 'Revisión de los partos del sistema (11/11/2026)';

const damConflict = (
  calf: string,
  sheetDam: string,
  systemDam: Ref,
  detail: string,
): Seed => ({
  category: 'PARENTAGE',
  message: detail,
  targets: [
    ['A', calf, 'Cría'],
    systemDam,
    ['A', sheetDam, 'Madre según la planilla'],
    ['B', calf, 'Parto'],
  ],
});

const missingDam = (calves: string[], dam: string, detail: string): Seed => ({
  category: 'PARENTAGE',
  message: `${detail} Qué hacer: confirmar y cargar la madre en la ficha de la cría; el parto se agrupa solo.`,
  targets: [
    ...calves.map((c): Ref => ['A', c, 'Cría sin madre']),
    ['A', dam, 'Madre según la planilla'],
  ],
});

const soldOffspring = (
  earTag: string,
  dam: string,
  service: string,
  noted: string,
): Seed => ({
  category: 'MISSING_RECORD',
  message:
    `La planilla anota que ${dam} parió de la monta del ${service} y que la cría se vendió, ` +
    `pero ese parto no está en el sistema (la fecha anotada, ${noted}, no corresponde a una gestación: parece la de la venta). ` +
    'Qué hacer: si se quiere en los indicadores, registrar el parto sin monta con la cría (arete y fecha reales) y luego darla de baja como vendida.',
  targets: [['A', earTag, 'Madre']],
});

const closeBirths = (dam: string, calves: string[], detail: string): Seed => ({
  category: 'DATES',
  source: SYSTEM,
  message:
    `${detail} Entre dos partos de la misma madre tiene que pasar al menos una gestación (unos 147 días): ` +
    'alguna de las crías tiene mal la madre o la fecha de nacimiento. Qué hacer: revisar las fichas de las crías y corregir la madre o la fecha.',
  targets: [
    ['A', dam, 'Madre'],
    ...calves.map((c): Ref => ['A', c, 'Cría']),
    ...calves.map((c): Ref => ['B', c, 'Parto']),
  ],
});

const SEEDS: Seed[] = [
  // ---------- Madre distinta en la planilla y en el sistema ----------
  damConflict(
    'CSR-12',
    '55',
    ['A', '0385', 'Madre en el sistema'],
    'Madre dudosa de CSR-12 FOEMA. La planilla dice que es hija de 55 JADE (monta del 15/04/2025 con SA-611 VESUVIO, parto el 13/09/2025). En el sistema figura como hija de 0385 VALENTE, pero VALENTE parió a CSR-34 el 08/10/2025, 25 días después: no puede ser madre de las dos. Lo más probable es que la madre sea 55 JADE. Qué hacer: confirmar y corregir la madre en la ficha de CSR-12.',
  ),
  damConflict(
    'CSR-33',
    '50',
    ['A', '22', 'Madre en el sistema'],
    'Madre dudosa de CSR-33 DAKOTA. La planilla dice que es hija de 50 PIETRA (monta del 09/05/2025 con 135 HERCULES, parto el 07/10/2025). En el sistema figura como hija de 22 MIEL, pero MIEL parió a CSR-15 el 16/09/2025, 21 días antes. Lo más probable es que la madre sea 50 PIETRA. Qué hacer: confirmar y corregir la madre en la ficha de CSR-33.',
  ),
  damConflict(
    'CSR-48',
    '59',
    ['A', '04', 'Madre en el sistema'],
    'Madre dudosa de CSR-48 PISTA. La planilla dice que es hija de 59 DOMINIQUE (monta del 21/05/2025 con SA-266 CALVIN, parto el 20/10/2025). En el sistema figura como hija de 04 GALA, pero GALA parió a CSR-42 el 14/10/2025, 6 días antes. Lo más probable es que la madre sea 59 DOMINIQUE. Qué hacer: confirmar y corregir la madre en la ficha de CSR-48.',
  ),
  damConflict(
    'CSR-66',
    '16',
    ['A', '1815', 'Madre en el sistema'],
    'Madre dudosa de CSR-66 MAXIMUS. La planilla dice que es hijo de 16 VESPERA (monta del 19/08/2025 con 135 HERCULES, parto el 16/01/2026). En el sistema figura como hijo de 1815 MIEL, pero MIEL parió a CSR-14 el 14/09/2025, solo 124 días antes. Lo más probable es que la madre sea 16 VESPERA. Qué hacer: confirmar y corregir la madre en la ficha de CSR-66.',
  ),
  damConflict(
    'CSR-77',
    '09',
    ['A', '63', 'Madre en el sistema'],
    'Madre dudosa de CSR-77 ORION. La planilla dice que es hijo de 09 VENCEDORA (monta del 11/12/2025 con 135 HERCULES, parto el 12/05/2026). En el sistema figura como hijo de 63 EUREA, pero EUREA parió a CSR-81 el 01/06/2026, 20 días después. Lo más probable es que la madre sea 09 VENCEDORA. Qué hacer: confirmar y corregir la madre en la ficha de CSR-77.',
  ),
  damConflict(
    'CSR-68',
    'CSR-280',
    ['A', '0425', 'Madre en el sistema'],
    'Madre dudosa de CSR-68 DINASTIA (nacida el 03/02/2026). La planilla la anota junto a CSR-280 ARROYO (fila sin fecha de monta). En el sistema figura como hija de 0425 BIANCA, pero BIANCA parió a CSR-82 el 07/06/2026, solo 124 días después. Qué hacer: confirmar la madre y corregirla en la ficha de CSR-68.',
  ),
  damConflict(
    'CSR-20',
    '84',
    ['A', '156', 'Madre en el sistema'],
    'Madre distinta para CSR-20 PANELA. La planilla dice que es hija de 84 AKIRA (monta del 28/04/2025 con SA-611 VESUVIO, parto el 01/10/2025). En el sistema figura como hija de 156 AMALIA. No hay otro dato que indique cuál es la correcta. Qué hacer: confirmar la madre y, si corresponde, corregirla en la ficha de CSR-20.',
  ),
  {
    category: 'PARENTAGE',
    message:
      'Madre distinta para CSR-17 ATALANTA y CSR-75 ULISSES. La planilla dice que las dos son crías de 33 CANELA con 135 HERCULES (montas del 30/04/2025 y del 09/12/2025, partos el 28/09/2025 y el 11/05/2026). En el sistema las dos figuran como crías de 1880 CLARISA. Puede ser la misma confusión entre las dos hembras. Qué hacer: confirmar la madre y, si corresponde, corregirla en la ficha de cada cría.',
    targets: [
      ['A', 'CSR-17', 'Cría'],
      ['A', 'CSR-75', 'Cría'],
      ['A', '1880', 'Madre en el sistema'],
      ['A', '33', 'Madre según la planilla'],
      ['B', 'CSR-17', 'Parto'],
      ['B', 'CSR-75', 'Parto'],
    ],
  },
  damConflict(
    'CSR-65',
    '90',
    ['A', '159', 'Madre en el sistema'],
    'Madre distinta para CSR-65 VALQUIRIA. La planilla dice que es hija de 90 MAGNIFICA (monta del 07/08/2025 con 135 HERCULES, parto el 12/01/2026). En el sistema figura como hija de 159 EVA. Qué hacer: confirmar la madre y, si corresponde, corregirla en la ficha de CSR-65.',
  ),
  damConflict(
    'CSR-53',
    'CSR-786',
    ['X', '785', 'Madre en el sistema (externa)'],
    'Madre dudosa de CSR-53 OURO (nacido el 13/11/2025). La planilla dice que es hijo de CSR-786 GALA, comprada preñada (padre externo 110). En el sistema figura como hijo de una hembra externa con registro 785. Parece una errata 785/786. Qué hacer: si la madre es CSR-786 GALA, corregirla en la ficha de CSR-53; si la hembra externa 785 no se usa en otro lado, se puede eliminar.',
  ),
  {
    category: 'PARENTAGE',
    message:
      'Madre dudosa de 217 MORENA y CSR-507 MAEVE. Las dos figuran como hijas de una hembra externa con registro 135, con partos el 26/07/2025 y el 24/10/2025: 90 días entre partos, imposible. La planilla dice que 217 es hija de 135 (2) HELENA con 119 PATA SECA. Probablemente al cargar los datos se confundió "135" con "135 (2)" HELENA. Qué hacer: corregir la madre de 217 a 135 (2) HELENA y averiguar la madre real de CSR-507.',
    targets: [
      ['A', '217', 'Cría'],
      ['A', 'CSR-507', 'Cría'],
      ['X', '135', 'Madre en el sistema (externa)'],
      ['A', '135 (2)', 'Madre según la planilla'],
      ['B', '217', 'Parto'],
      ['B', 'CSR-507', 'Parto'],
    ],
  },

  // ---------- Padre distinto ----------
  {
    category: 'PARENTAGE',
    message:
      'Padre distinto para CSR-16 MONARCA (madre 192 SAHARA). La planilla anota la monta del 07/04/2025 con SA-611 VESUVIO y el parto el 20/09/2025; en el sistema el padre es 135 HERCULES. Con la monta de la planilla la gestación sería de 166 días (lo normal es 140–160): pudo repetir celo y quedar preñada en una monta posterior no anotada, lo que daría la razón al sistema. Qué hacer: confirmar el padre y, si corresponde, corregirlo en la ficha de CSR-16.',
    targets: [
      ['A', 'CSR-16', 'Cría'],
      ['A', '135', 'Padre en el sistema'],
      ['A', 'SA-611', 'Padre según la planilla'],
      ['B', 'CSR-16', 'Parto'],
    ],
  },
  {
    category: 'PARENTAGE',
    message:
      'Padre distinto para CSR-11 SOFI (madre 2306 CATALINA). La planilla anota la monta del 14/04/2025 con 135 HERCULES y el parto el 13/09/2025 (152 días, una gestación normal); en el sistema el padre es SA-611 VESUVIO. Qué hacer: confirmar el padre y, si corresponde, corregirlo en la ficha de CSR-11.',
    targets: [
      ['A', 'CSR-11', 'Cría'],
      ['A', 'SA-611', 'Padre en el sistema'],
      ['A', '135', 'Padre según la planilla'],
      ['B', 'CSR-11', 'Parto'],
    ],
  },
  {
    category: 'PARENTAGE',
    message:
      'Padre distinto para CSR-09 CANELA (madre 0425 BIANCA). La planilla anota la monta del 25/04/2025 con 135 HERCULES y el parto el 25/08/2025; en el sistema el padre es SA-611 VESUVIO. Con esa monta la gestación sería de 122 días, demasiado corta: probablemente la preñó una monta anterior, quizás con VESUVIO como dice el sistema. Qué hacer: confirmar el padre y, si corresponde, corregirlo en la ficha de CSR-09.',
    targets: [
      ['A', 'CSR-09', 'Cría'],
      ['A', 'SA-611', 'Padre en el sistema'],
      ['A', '135', 'Padre según la planilla'],
      ['B', 'CSR-09', 'Parto'],
    ],
  },
  {
    category: 'PARENTAGE',
    message:
      'Padre distinto para CSR-43 SANGUE (madre 0539 THAMAR). La planilla anota la monta del 13/05/2025 con 4568 TRIUNFO y el parto el 14/10/2025; en el sistema el padre es un macho externo con registro 6435. Qué hacer: confirmar el padre y, si corresponde, corregirlo en la ficha de CSR-43.',
    targets: [
      ['A', 'CSR-43', 'Cría'],
      ['X', '6435', 'Padre en el sistema (externo)'],
      ['A', '4568', 'Padre según la planilla'],
      ['B', 'CSR-43', 'Parto'],
    ],
  },
  {
    category: 'PARENTAGE',
    message:
      'Padres de CSR-55 NATO. La planilla anota la monta del 24/06/2025 de 00239 SIAH con el macho externo 547 ("B-547") y el parto el 26/11/2025. En el sistema la cría no tiene madre y su padre es el macho externo 600. Qué hacer: cargar la madre (00239 SIAH), confirmar el padre y corregirlo si corresponde.',
    targets: [
      ['A', 'CSR-55', 'Cría'],
      ['A', '00239', 'Madre según la planilla'],
      ['X', '600', 'Padre en el sistema (externo)'],
      ['X', '547', 'Padre según la planilla (externo)'],
    ],
  },
  {
    category: 'PARENTAGE',
    message:
      'Padre y fecha distintos para CSR-58 REIS (madre 1994 RADIANTE). La planilla anota la monta del 30/06/2025 con 135 HERCULES y el parto el 28/12/2025; en el sistema el padre es SA-266 CALVIN y nació el 21/12/2025. Con la monta de la planilla la gestación sería de 174 a 181 días: pudo repetir celo y quedar preñada de CALVIN. Qué hacer: confirmar el padre y la fecha de nacimiento, y corregirlos si corresponde.',
    targets: [
      ['A', 'CSR-58', 'Cría'],
      ['A', 'SA-266', 'Padre en el sistema'],
      ['A', '135', 'Padre según la planilla'],
      ['B', 'CSR-58', 'Parto'],
    ],
  },

  // ---------- Arete repetido ----------
  {
    category: 'IDENTIFIER',
    message:
      'Arete CSR-89 repetido. La planilla anota una cría CSR-89 de 97 ESTRELLA con 135 HERCULES, nacida el 21/07/2026 (monta del 20/02/2026). En el sistema, CSR-89 es BELEN, una hembra nacida el 31/03/2025 (madre externa 185, padre externo 743) que ya se usa como reproductora. La cría de ESTRELLA no está en el sistema. Qué hacer: averiguar el arete real de la cría y registrar el parto de 97 ESTRELLA.',
    targets: [
      ['A', 'CSR-89', 'Animal con ese arete'],
      ['A', '97', 'Madre según la planilla'],
    ],
  },

  // ---------- Crías sin madre en el sistema ----------
  missingDam(
    ['CSR-13'],
    '0',
    'CSR-13 SARITA no tiene madre en el sistema. La planilla dice que es hija de 0 NALA (monta del 15/04/2025 con SA-611 VESUVIO, parto el 13/09/2025).',
  ),
  {
    category: 'IDENTIFIER',
    message:
      'Arete CSR-35 dudoso. En el sistema, CSR-35 es RAMSES: existencia inicial, sin fecha de nacimiento ni padres, vendido el 29/09/2025. La planilla dice que CSR-35 nació en la cabaña el 10/10/2025, mellizo de CSR-36, cría de 32 THIRA con 135 HERCULES (monta del 13/05/2025). No puede ser RAMSES, que se vendió antes. Qué hacer: averiguar el arete real del mellizo de CSR-36 y registrarlo, o corregir el arete de RAMSES.',
    targets: [
      ['A', 'CSR-35', 'Animal con ese arete'],
      ['A', '32', 'Madre según la planilla'],
      ['A', 'CSR-36', 'Mellizo según la planilla'],
      ['B', 'CSR-36', 'Parto'],
    ],
  },
  missingDam(
    ['CSR-37', 'CSR-38'],
    '58',
    'CSR-37 y CSR-38 no tienen madre en el sistema. La planilla dice que son mellizos de 58 MELISENDA con 135 HERCULES (monta del 14/05/2025, parto el 09/10/2025).',
  ),
  missingDam(
    ['CSR-56'],
    '69075',
    'CSR-56 ABSOLUTO no tiene madre en el sistema. La planilla dice que es hijo de 69075 MAYA, comprada preñada (padre externo 1305), nacido el 29/11/2025.',
  ),
  missingDam(
    ['CSR-69'],
    '07',
    'CSR-69 no tiene madre en el sistema. La planilla dice que es cría de 07 LEOA (monta del 08/09/2025 con SA-151 ICARO, parto el 06/02/2026).',
  ),
  missingDam(
    ['CSR-91'],
    '303',
    'CSR-91 no tiene madre en el sistema. La planilla dice que es cría de 303 ANDROMEDA (monta del 05/03/2026 con 135 HERCULES, parto el 02/08/2026).',
  ),

  // ---------- Partos de la planilla que no están en el sistema ----------
  {
    category: 'MISSING_RECORD',
    message:
      'La planilla anota un parto de 0454 DUNA el 26/09/2025 (monta del 19/04/2025 con SA-611 VESUVIO) con la cría CSR-21, que no está en el sistema. Qué hacer: si la cría existe, registrar el parto sin monta; si no hubo parto, corregir la planilla.',
    targets: [['A', '0454', 'Madre']],
  },
  {
    category: 'MISSING_RECORD',
    message:
      'La planilla anota un parto de 11 CHOCOLATE el 29/09/2025 (monta del 02/05/2025 con 135 HERCULES) con la cría CSR-22, que no está en el sistema. Qué hacer: si la cría existe, registrar el parto sin monta; si no hubo parto, corregir la planilla.',
    targets: [['A', '11', 'Madre']],
  },
  soldOffspring(
    '121',
    '121 FRANCESCA',
    '23/04/2025 con SA-611 VESUVIO',
    '01/09/2025',
  ),
  soldOffspring(
    '35',
    '35 HERDEIRA',
    '03/05/2025 con SA-611 VESUVIO',
    '01/09/2025',
  ),
  soldOffspring('20', '20 CLAU', '05/05/2025 con SA-266 CALVIN', '30/05/2025'),
  soldOffspring('28', '28 BOMBON', '06/05/2025 con 135 HERCULES', '14/10/2025'),
  soldOffspring(
    '34 (2)',
    '34 (2) LEOPOLDINA',
    '12/06/2025 con 135 HERCULES',
    '30/12/2025',
  ),
  soldOffspring(
    '29',
    '29 DAMDARA',
    '06/08/2025 con 135 HERCULES',
    '02/09/2025',
  ),
  soldOffspring('93', '93 DAMA', '23/08/2025 con 135 HERCULES', '25/10/225'),

  // ---------- Fechas ----------
  {
    category: 'DATES',
    message:
      'Gestación demasiado corta para CSR-06 NOBRE (madre 0354 SOBERANA): la planilla anota la monta del 19/04/2025 con SA-611 VESUVIO y el parto fue el 17/08/2025, 120 días después (lo normal es 140–160). La monta que la preñó fue otra, anterior y no anotada. Qué hacer: revisar la fecha de nacimiento de la cría y completar la monta en la planilla.',
    targets: [
      ['A', '0354', 'Madre'],
      ['A', 'CSR-06', 'Cría'],
      ['B', 'CSR-06', 'Parto'],
    ],
  },
  {
    category: 'DATES',
    message:
      'Gestación demasiado corta para CSR-15 DANTE (madre 22 MIEL): la planilla anota la monta del 21/05/2025 con SA-611 VESUVIO y el parto fue el 16/09/2025, 118 días después (lo normal es 140–160). La monta que la preñó fue otra, anterior y no anotada. Qué hacer: revisar la fecha de nacimiento de la cría y completar la monta en la planilla.',
    targets: [
      ['A', '22', 'Madre'],
      ['A', 'CSR-15', 'Cría'],
      ['B', 'CSR-15', 'Parto'],
    ],
  },
  {
    category: 'DATES',
    message:
      'Fecha de nacimiento distinta para CSR-67 GRANDE (madre 3039 AIRA): el sistema dice 22/01/2026 y la planilla anota el parto el 05/02/2026. Con la monta del 23/08/2025 la fecha del sistema da 152 días de gestación (normal) y la de la planilla 166. Qué hacer: confirmar la fecha; probablemente el sistema está bien y hay que corregir la planilla.',
    targets: [
      ['A', 'CSR-67', 'Cría'],
      ['A', '3039', 'Madre'],
      ['B', 'CSR-67', 'Parto'],
    ],
  },

  // ---------- Partos muy cercanos (solo en el sistema) ----------
  closeBirths(
    '1015',
    ['170', '197'],
    'Partos de 1015 OLIMPIA demasiado cercanos: 170 FREYA nació el 05/11/2024 y 197 VLAD el 15/03/2025 (130 días).',
  ),
  closeBirths(
    '3050',
    ['171', '172'],
    'Partos de 3050 EMPERATIZ demasiado cercanos: 171 LEONIDAS nació el 19/11/2024 y 172 RANI el 25/11/2024 (6 días). Si son mellizos, la fecha de uno está mal cargada.',
  ),
  closeBirths(
    '1738',
    ['156', '160', '179'],
    'Partos de 1738 BONIÑA demasiado cercanos: 156 AMALIA nació el 11/10/2024, 160 CAETANO el 13/10/2024 (2 días después) y 179 KRONOS el 12/12/2024 (60 días después).',
  ),
  closeBirths(
    '1798',
    ['108', '157'],
    'Partos de 1798 THAMAR demasiado cercanos: 108 DINASTIA nació el 13/09/2024 y 157 AKERA el 11/10/2024 (28 días).',
  ),
  closeBirths(
    '124',
    ['209', 'CSR-505'],
    'Partos de 124 MARTHA demasiado cercanos: los trillizos 209, 210 y 211 nacieron el 29/04/2025 y CSR-505 NINA el 14/09/2025 (138 días). La planilla confirma el parto de CSR-505, así que conviene revisar los trillizos.',
  ),
  closeBirths(
    '132',
    ['139', '127'],
    'Partos de 132 CANELA demasiado cercanos: 139 RUBI nació el 08/08/2024 y 127 ATLAS el 31/08/2024 (23 días).',
  ),
  closeBirths(
    '63',
    ['96', '161'],
    'Partos de 63 EUREA demasiado cercanos: 96 DRUSILA nació el 03/07/2024 y 161 SOL el 16/10/2024 (105 días).',
  ),
  closeBirths(
    '1329',
    ['38', '163'],
    'Partos de 1329 AGATA demasiado cercanos: 38 BELLATRIX nació el 04/07/2024 y 163 ZARA el 18/10/2024 (106 días).',
  ),
  closeBirths(
    '0385',
    ['153', '155'],
    'Partos de 0385 VALENTE demasiado cercanos: 153 ATENEA nació el 10/10/2024 y 155 VISCONDE y 158 el 11/10/2024 (1 día). Probablemente son trillizos y una fecha está mal cargada: al unificar la fecha de nacimiento, las tres crías quedan en un solo parto.',
  ),
  closeBirths(
    '30',
    ['202', 'CSR-274'],
    'Partos de 30 RANI demasiado cercanos: 202 SAGRADO nació el 21/03/2025 y CSR-274 JAPA el 27/05/2025 (67 días).',
  ),
];

export class ProductionSheetReviews1794422956698 implements MigrationInterface {
  name = 'ProductionSheetReviews1794422956698';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const seed of SEEDS) {
      const targets: { type: string; id: string; role: string }[] = [];
      for (const [kind, value, role] of seed.targets) {
        const id = await resolve(queryRunner, kind, value);
        if (!id) continue;
        const type = kind === 'B' ? 'BIRTH' : 'ANIMAL';
        if (targets.some((t) => t.type === type && t.id === id)) continue;
        targets.push({ type, id, role });
      }
      if (targets.length === 0) continue;

      const reviewId = randomUUID();
      await queryRunner.query(
        `INSERT INTO "data_reviews" ("id", "category", "message", "source", "status")
         VALUES ($1, $2, $3, $4, 'OPEN')`,
        [reviewId, seed.category, seed.message, seed.source ?? SHEET],
      );
      for (const [i, t] of targets.entries()) {
        await queryRunner.query(
          `INSERT INTO "data_review_targets" ("id", "review_id", "entity_type", "entity_id", "role", "position")
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), reviewId, t.type, t.id, t.role, i + 1],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "data_reviews" WHERE "source" IN ($1, $2)`,
      [SHEET, SYSTEM],
    );
  }
}

/** Id del registro, o null si no hay exactamente uno. */
async function resolve(
  queryRunner: QueryRunner,
  kind: Ref[0],
  value: string,
): Promise<string | null> {
  const sql = {
    A: `SELECT "id" FROM "animals"
         WHERE "ear_tag" = $1 AND NOT "is_external" AND "deleted_at" IS NULL`,
    X: `SELECT "id" FROM "animals"
         WHERE "external_registry" = $1 AND "is_external" AND "deleted_at" IS NULL`,
    B: `SELECT b."id" FROM "births" b
          JOIN "birth_offspring" bo ON bo."birth_id" = b."id"
          JOIN "animals" a ON a."id" = bo."animal_id"
         WHERE a."ear_tag" = $1 AND NOT a."is_external" AND a."deleted_at" IS NULL
           AND b."deleted_at" IS NULL`,
  }[kind];
  const rows = (await queryRunner.query(sql, [value])) as { id: string }[];
  return rows.length === 1 ? rows[0].id : null;
}
