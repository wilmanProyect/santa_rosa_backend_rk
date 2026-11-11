import { Sex } from '@modules/animals/domain/enums/animal.enums';
import { KINSHIP_GENERATIONS } from './enums/reproduction.enums';

/** Un animal de la genealogía, con los IDs de sus padres. */
export interface PedigreeNode {
  id: string;
  earTag: string | null;
  name: string | null;
  sex: Sex;
  damId: string | null;
  sireId: string | null;
}

export type Pedigree = ReadonlyMap<string, PedigreeNode>;

export interface CommonAncestor {
  id: string;
  earTag: string | null;
  name: string | null;
  /** Generaciones entre la hembra y el ancestro (0: es la propia hembra). */
  damGeneration: number;
  /** Generaciones entre el macho y el ancestro (0: es el propio macho). */
  sireGeneration: number;
  /** "abuela materna de la hembra y madre del macho". */
  description: string;
}

export interface KinshipAnalysis {
  related: boolean;
  /** Parentesco más cercano: "medio hermanos", "padre e hija"... null si no hay. */
  relationship: string | null;
  commonAncestors: CommonAncestor[];
  /**
   * Coeficiente de consanguinidad (Wright) que tendría la cría, de 0 a 1.
   * Aproximado: no suma la consanguinidad propia de los ancestros comunes.
   */
  inbreedingCoefficient: number;
  /** Ancestros conocidos de cada uno (de 14 posibles en 3 generaciones). */
  knownAncestors: { dam: number; sire: number; possible: number };
  /** Avisos de genealogía incompleta: el control podría no ver un vínculo. */
  warnings: string[];
}

/**
 * Busca ancestros comunes entre la hembra y el macho hasta `generations`
 * generaciones (padres, abuelos, bisabuelos), incluida la relación directa
 * (uno es ancestro del otro).
 *
 * Cuenta cada par de caminos hembra → ancestro ← macho que no comparten otro
 * animal (regla de Wright): F = Σ (1/2)^(n1 + n2 + 1).
 */
export function analyzeKinship(
  damId: string,
  sireId: string,
  pedigree: Pedigree,
  generations = KINSHIP_GENERATIONS,
): KinshipAnalysis {
  const damPaths = ancestorPaths(damId, pedigree, generations);
  const sirePaths = ancestorPaths(sireId, pedigree, generations);

  let coefficient = 0;
  const closest = new Map<string, { n1: number; n2: number }>();
  for (const dp of damPaths) {
    for (const sp of sirePaths) {
      const ancestor = dp[dp.length - 1];
      if (ancestor !== sp[sp.length - 1]) continue;
      if (!disjointBelow(dp, sp)) continue;
      const n1 = dp.length - 1;
      const n2 = sp.length - 1;
      coefficient += 0.5 ** (n1 + n2 + 1);
      const best = closest.get(ancestor);
      if (!best || n1 + n2 < best.n1 + best.n2) {
        closest.set(ancestor, { n1, n2 });
      }
    }
  }

  const commonAncestors: CommonAncestor[] = [...closest.entries()]
    .map(([id, { n1, n2 }]) => {
      const node = pedigree.get(id);
      return {
        id,
        earTag: node?.earTag ?? null,
        name: node?.name ?? null,
        damGeneration: n1,
        sireGeneration: n2,
        description: describeAncestor(id, n1, n2, damId, sireId, pedigree),
      };
    })
    .sort(
      (a, b) =>
        a.damGeneration +
        a.sireGeneration -
        (b.damGeneration + b.sireGeneration),
    );

  const possible = 2 ** (generations + 1) - 2;
  const known = {
    dam: damPaths.filter((p) => p.length > 1).length,
    sire: sirePaths.filter((p) => p.length > 1).length,
  };
  const warnings: string[] = [];
  for (const [who, id, count] of [
    ['de la hembra', damId, known.dam],
    ['del macho', sireId, known.sire],
  ] as const) {
    const node = pedigree.get(id);
    if (!node?.damId || !node?.sireId) {
      warnings.push(
        `No se conoce ${!node?.damId && !node?.sireId ? 'la madre ni el padre' : !node?.damId ? 'la madre' : 'el padre'} ${who}: el control de parentesco no puede garantizar que no estén emparentados.`,
      );
    } else if (count < possible) {
      warnings.push(
        `Genealogía incompleta ${who}: se conocen ${count} de ${possible} ancestros en ${generations} generaciones.`,
      );
    }
  }

  return {
    related: commonAncestors.length > 0,
    relationship: relationshipName(commonAncestors, damId, sireId, pedigree),
    commonAncestors,
    inbreedingCoefficient: Math.round(coefficient * 100_000) / 100_000,
    knownAncestors: { ...known, possible },
    warnings,
  };
}

/**
 * Caminos desde `start` hacia sus ancestros: [start], [start, padre],
 * [start, padre, abuelo]... hasta `generations`. Un ancestro que aparece por
 * dos ramas da dos caminos (por eso se cuentan "ancestros conocidos" por camino).
 */
function ancestorPaths(
  start: string,
  pedigree: Pedigree,
  generations: number,
): string[][] {
  const result: string[][] = [];
  const walk = (path: string[]) => {
    result.push(path);
    if (path.length - 1 >= generations) return;
    const node = pedigree.get(path[path.length - 1]);
    for (const parent of [node?.damId, node?.sireId]) {
      // Un ciclo sería un error de datos: no se recorre dos veces el mismo animal.
      if (parent && !path.includes(parent)) walk([...path, parent]);
    }
  };
  walk([start]);
  return result;
}

/** Los dos caminos solo comparten el ancestro común (su último elemento). */
function disjointBelow(a: string[], b: string[]): boolean {
  const below = new Set(a.slice(0, -1));
  return b.slice(0, -1).every((id) => !below.has(id));
}

const GENERATION_NAMES: Record<number, [string, string]> = {
  1: ['padre', 'madre'],
  2: ['abuelo', 'abuela'],
  3: ['bisabuelo', 'bisabuela'],
};

function kinName(generation: number, sex: Sex | null): string {
  const [male, female] = GENERATION_NAMES[generation] ?? [
    `ancestro (${generation} generaciones)`,
    `ancestro (${generation} generaciones)`,
  ];
  return sex === Sex.FEMALE ? female : male;
}

function sexOf(id: string, pedigree: Pedigree): Sex | null {
  const node = pedigree.get(id);
  if (node) return node.sex;
  for (const n of pedigree.values()) {
    if (n.damId === id) return Sex.FEMALE;
    if (n.sireId === id) return Sex.MALE;
  }
  return null;
}

function label(id: string, pedigree: Pedigree): string {
  const node = pedigree.get(id);
  return node?.earTag ?? node?.name ?? id;
}

function describeAncestor(
  id: string,
  n1: number,
  n2: number,
  damId: string,
  sireId: string,
  pedigree: Pedigree,
): string {
  if (id === damId) {
    return `La hembra es ${kinName(n2, Sex.FEMALE)} del macho`;
  }
  if (id === sireId) {
    return `El macho es ${kinName(n1, Sex.MALE)} de la hembra`;
  }
  const sex = sexOf(id, pedigree);
  return `${label(id, pedigree)} es ${kinName(n1, sex)} de la hembra y ${kinName(n2, sex)} del macho`;
}

function relationshipName(
  ancestors: CommonAncestor[],
  damId: string,
  sireId: string,
  pedigree: Pedigree,
): string | null {
  if (ancestors.length === 0) return null;
  const { damGeneration: n1, sireGeneration: n2 } = ancestors[0];
  const direct: Record<number, string> = {
    1: 'padre/madre e hijo/a',
    2: 'abuelo/a y nieto/a',
    3: 'bisabuelo/a y bisnieto/a',
  };
  if (n1 === 0 || n2 === 0) return direct[n1 + n2] ?? 'ancestro directo';
  if (n1 === 1 && n2 === 1) {
    const dam = pedigree.get(damId);
    const sire = pedigree.get(sireId);
    const full =
      dam?.damId &&
      dam.sireId &&
      dam.damId === sire?.damId &&
      dam.sireId === sire?.sireId;
    return full ? 'hermanos' : 'medio hermanos';
  }
  const key = [n1, n2].sort().join('-');
  const names: Record<string, string> = {
    '1-2': 'tío/a y sobrino/a',
    '1-3': 'tío/a abuelo/a y sobrino/a nieto/a',
    '2-2': 'primos hermanos',
    '2-3': 'primos hermanos con una generación de diferencia',
    '3-3': 'primos segundos',
  };
  return names[key] ?? 'parientes';
}
