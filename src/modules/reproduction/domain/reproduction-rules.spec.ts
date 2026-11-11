import {
  GeneticCategory as G,
  Sex,
} from '@modules/animals/domain/enums/animal.enums';
import {
  expectedOffspringCategory,
  isUpgrade,
} from './genetic-category-inheritance';
import { analyzeKinship, PedigreeNode } from './kinship';

describe('expectedOffspringCategory', () => {
  it.each([
    [G.BASE, G.PO, G.G1],
    [G.G1, G.PO, G.G2],
    [G.G2, G.PO, G.G3],
    [G.G3, G.PO, G.G4],
    [G.G4, G.PO, G.PO],
    [G.G3, G.BASE, G.G1],
    [G.BASE, G.G3, G.G1],
    [G.G1, G.G2, G.G2],
    [G.G1, G.G1, G.G1],
    [G.PO, G.PO, G.PO],
    [G.COMMERCIAL, G.PO, G.BASE],
    [G.COMMERCIAL, G.G1, G.BASE],
    [G.G4, G.COMMERCIAL, G.BASE],
    [G.COMMERCIAL, G.COMMERCIAL, G.COMMERCIAL],
  ])('%s × %s = %s', (dam, sire, offspring) => {
    expect(expectedOffspringCategory(dam, sire)).toBe(offspring);
  });

  it('no calcula si falta una categoría o es COMMERCIAL × BASE', () => {
    expect(expectedOffspringCategory(null, G.PO)).toBeNull();
    expect(expectedOffspringCategory(G.BASE, null)).toBeNull();
    expect(expectedOffspringCategory(G.COMMERCIAL, G.BASE)).toBeNull();
  });

  it('detecta el ascenso respecto de la madre', () => {
    expect(isUpgrade(G.BASE, G.G1)).toBe(true);
    expect(isUpgrade(G.G1, G.G1)).toBe(false);
    expect(isUpgrade(G.COMMERCIAL, G.BASE)).toBe(true);
    expect(isUpgrade(G.PO, null)).toBe(false);
  });
});

/** Arma una genealogía: id → [madre, padre]. Los F* son hembras. */
function pedigree(
  parents: Record<string, [string | null, string | null]>,
): Map<string, PedigreeNode> {
  const ids = new Set([
    ...Object.keys(parents),
    ...Object.values(parents)
      .flat()
      .filter((id): id is string => id !== null),
  ]);
  return new Map(
    [...ids].map((id) => [
      id,
      {
        id,
        earTag: id,
        name: null,
        sex: id.startsWith('F') ? Sex.FEMALE : Sex.MALE,
        damId: parents[id]?.[0] ?? null,
        sireId: parents[id]?.[1] ?? null,
      },
    ]),
  );
}

describe('analyzeKinship', () => {
  it('sin ancestros comunes', () => {
    const result = analyzeKinship(
      'F1',
      'M1',
      pedigree({ F1: ['F2', 'M2'], M1: ['F3', 'M3'] }),
    );
    expect(result.related).toBe(false);
    expect(result.inbreedingCoefficient).toBe(0);
    expect(result.relationship).toBeNull();
  });

  it('padre e hija', () => {
    const result = analyzeKinship(
      'F1',
      'M1',
      pedigree({ F1: ['F2', 'M1'], M1: [null, null] }),
    );
    expect(result.related).toBe(true);
    expect(result.relationship).toBe('padre/madre e hijo/a');
    expect(result.inbreedingCoefficient).toBe(0.25);
    expect(result.commonAncestors[0].description).toBe(
      'El macho es padre de la hembra',
    );
  });

  it('hermanos completos y medio hermanos', () => {
    const full = analyzeKinship(
      'F1',
      'M1',
      pedigree({ F1: ['FA', 'MA'], M1: ['FA', 'MA'] }),
    );
    expect(full.relationship).toBe('hermanos');
    expect(full.inbreedingCoefficient).toBe(0.25);

    const half = analyzeKinship(
      'F1',
      'M1',
      pedigree({ F1: ['FA', 'MA'], M1: ['FB', 'MA'] }),
    );
    expect(half.relationship).toBe('medio hermanos');
    expect(half.inbreedingCoefficient).toBe(0.125);
    expect(half.commonAncestors).toHaveLength(1);
    expect(half.commonAncestors[0].description).toBe(
      'MA es padre de la hembra y padre del macho',
    );
  });

  it('primos hermanos (comparten abuelos) y no cuenta dos veces a los bisabuelos', () => {
    const result = analyzeKinship(
      'F1',
      'M1',
      pedigree({
        F1: ['F2', 'M2'],
        M1: ['F3', 'M3'],
        // F2 y M3 son hermanos: hijos de FG y MG, que a su vez tienen padres.
        F2: ['FG', 'MG'],
        M3: ['FG', 'MG'],
        FG: ['FBB', 'MBB'],
      }),
    );
    expect(result.relationship).toBe('primos hermanos');
    expect(result.inbreedingCoefficient).toBe(0.0625);
    expect(result.commonAncestors.map((a) => a.id).sort()).toEqual([
      'FG',
      'MG',
    ]);
    expect(result.commonAncestors.find((a) => a.id === 'FG')?.description).toBe(
      'FG es abuela de la hembra y abuela del macho',
    );
  });

  it('bisabuelo: dentro de las 3 generaciones', () => {
    const result = analyzeKinship(
      'F1',
      'M1',
      pedigree({ F1: ['F2', 'M2'], F2: ['F3', 'M3'], F3: ['F4', 'M1'] }),
    );
    expect(result.relationship).toBe('bisabuelo/a y bisnieto/a');
  });

  it('ancestro común a 4 generaciones: fuera del control', () => {
    const result = analyzeKinship(
      'F1',
      'M1',
      pedigree({
        F1: ['F2', null],
        F2: ['F3', null],
        F3: ['F4', null],
        F4: ['FX', null],
        M1: ['FY', null],
        FY: ['FX', null],
      }),
    );
    expect(result.related).toBe(false);
  });

  it('avisa si falta la genealogía', () => {
    const result = analyzeKinship(
      'F1',
      'M1',
      pedigree({ F1: ['F2', null], M1: ['F3', 'M3'] }),
    );
    expect(result.warnings[0]).toContain('No se conoce el padre de la hembra');
    expect(result.warnings[1]).toContain('Genealogía incompleta del macho');
    expect(result.knownAncestors).toEqual({ dam: 1, sire: 2, possible: 14 });
  });
});
