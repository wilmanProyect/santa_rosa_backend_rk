import { GeneticCategory } from '@modules/animals/domain/enums/animal.enums';

/** Escalera de absorción ABSID, de menor a mayor. */
const LADDER = [
  GeneticCategory.BASE,
  GeneticCategory.G1,
  GeneticCategory.G2,
  GeneticCategory.G3,
  GeneticCategory.G4,
  GeneticCategory.PO,
];

/**
 * Categoría genética esperada de la cría según la de sus padres (reglas de la
 * cabaña):
 *
 * - Padres con la misma categoría: la cría la conserva (G1 × G1 = G1).
 * - Categorías distintas: la cría queda un escalón arriba del padre de menor
 *   categoría (BASE × PO = G1, G3 × BASE = G1, G4 × PO = PO).
 * - COMMERCIAL con G1, G2, G3, G4 o PO: BASE.
 *
 * Devuelve null cuando no se puede calcular (falta la categoría de un padre o
 * COMMERCIAL × BASE): la categoría se carga a mano.
 */
export function expectedOffspringCategory(
  dam: GeneticCategory | null,
  sire: GeneticCategory | null,
): GeneticCategory | null {
  if (!dam || !sire) return null;
  if (dam === sire) return dam;

  if (
    dam === GeneticCategory.COMMERCIAL ||
    sire === GeneticCategory.COMMERCIAL
  ) {
    const other = dam === GeneticCategory.COMMERCIAL ? sire : dam;
    return other === GeneticCategory.BASE ? null : GeneticCategory.BASE;
  }

  const lower = Math.min(LADDER.indexOf(dam), LADDER.indexOf(sire));
  return LADDER[lower + 1];
}

/** true si la categoría de la cría es mayor que la de la madre. */
export function isUpgrade(
  dam: GeneticCategory | null,
  offspring: GeneticCategory | null,
): boolean {
  if (!dam || !offspring) return false;
  if (dam === GeneticCategory.COMMERCIAL) {
    return offspring !== GeneticCategory.COMMERCIAL;
  }
  return LADDER.indexOf(offspring) > LADDER.indexOf(dam);
}
