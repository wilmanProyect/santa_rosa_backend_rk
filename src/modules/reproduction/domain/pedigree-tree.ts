import {
  AnimalStatus,
  GeneticCategory,
  Sex,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import { analyzeKinship, PedigreeNode } from './kinship';

/** Generaciones del árbol genealógico: 1 = padres, 2 = abuelos, 3 = bisabuelos... */
export const PEDIGREE_GENERATIONS = { min: 1, max: 6, default: 4 };

/** Un animal del árbol, con los datos que se muestran en cada casilla. */
export interface PedigreeAnimal extends PedigreeNode {
  species: Species;
  birthDate: string | null;
  isExternal: boolean;
  status: AnimalStatus;
  geneticCategory: GeneticCategory | null;
  absidRegistry: string | null;
  breedName: string | null;
}

export interface PedigreeTreeNode {
  id: string;
  earTag: string | null;
  name: string | null;
  sex: Sex;
  birthDate: string | null;
  isExternal: boolean;
  status: AnimalStatus;
  geneticCategory: GeneticCategory | null;
  absidRegistry: string | null;
  breedName: string | null;
  /** 0 = el animal; 1 = sus padres; 2 = abuelos... */
  generation: number;
  /**
   * Madre y padre. `null`: no se conoce. En la última generación pedida no
   * vienen; `hasMoreAncestors` indica si hay más hacia atrás.
   */
  dam?: PedigreeTreeNode | null;
  sire?: PedigreeTreeNode | null;
  hasMoreAncestors?: boolean;
}

export interface PedigreeResult {
  generations: number;
  tree: PedigreeTreeNode;
  /** Por generación: ancestros conocidos sobre los posibles (2, 4, 8...). */
  completeness: { generation: number; known: number; possible: number }[];
  /** Ancestros que aparecen más de una vez (por consanguinidad). */
  repeatedAncestors: {
    id: string;
    earTag: string | null;
    name: string | null;
    occurrences: number;
  }[];
  /**
   * Consanguinidad del animal: el parentesco entre su madre y su padre
   * (dentro de las generaciones cargadas). null si falta alguno de los dos.
   */
  inbreeding: {
    coefficient: number;
    relationship: string | null;
    commonAncestors: {
      id: string;
      earTag: string | null;
      name: string | null;
      description: string;
    }[];
  } | null;
}

/**
 * Arma el árbol del animal `rootId` con `nodes` (él y sus ancestros). Un
 * ancestro repetido aparece en cada rama donde corresponde.
 */
export function buildPedigree(
  rootId: string,
  nodes: PedigreeAnimal[],
  generations: number,
): PedigreeResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = byId.get(rootId);
  if (!root)
    throw new Error(`El animal ${rootId} no está en la genealogía cargada`);

  const known = Array.from({ length: generations }, () => 0);
  const occurrences = new Map<string, number>();

  const build = (
    animal: PedigreeAnimal,
    generation: number,
  ): PedigreeTreeNode => {
    const node: PedigreeTreeNode = {
      id: animal.id,
      earTag: animal.earTag,
      name: animal.name,
      sex: animal.sex,
      birthDate: animal.birthDate,
      isExternal: animal.isExternal,
      status: animal.status,
      geneticCategory: animal.geneticCategory,
      absidRegistry: animal.absidRegistry,
      breedName: animal.breedName,
      generation,
    };
    if (generation > 0) {
      known[generation - 1]++;
      occurrences.set(animal.id, (occurrences.get(animal.id) ?? 0) + 1);
    }
    const parent = (id: string | null) => {
      const found = id ? byId.get(id) : undefined;
      return found ? build(found, generation + 1) : null;
    };
    if (generation < generations) {
      node.dam = parent(animal.damId);
      node.sire = parent(animal.sireId);
    } else {
      // Los ancestros de más atrás no se cargan: basta saber si tiene padres.
      node.hasMoreAncestors = Boolean(animal.damId || animal.sireId);
    }
    return node;
  };

  const tree = build(root, 0);

  let inbreeding: PedigreeResult['inbreeding'] = null;
  // Se necesitan al menos los abuelos para ver si los padres están emparentados.
  if (
    generations >= 2 &&
    root.damId &&
    root.sireId &&
    byId.has(root.damId) &&
    byId.has(root.sireId)
  ) {
    const analysis = analyzeKinship(
      root.damId,
      root.sireId,
      byId,
      generations - 1,
    );
    inbreeding = {
      coefficient: analysis.inbreedingCoefficient,
      relationship: analysis.relationship,
      commonAncestors: analysis.commonAncestors.map((a) => ({
        id: a.id,
        earTag: a.earTag,
        name: a.name,
        description: a.description,
      })),
    };
  }

  return {
    generations,
    tree,
    completeness: known.map((count, i) => ({
      generation: i + 1,
      known: count,
      possible: 2 ** (i + 1),
    })),
    repeatedAncestors: [...occurrences.entries()]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => {
        const a = byId.get(id)!;
        return { id, earTag: a.earTag, name: a.name, occurrences: count };
      })
      .sort((a, b) => b.occurrences - a.occurrences),
    inbreeding,
  };
}
