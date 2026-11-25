import {
  AnimalStatus,
  Sex,
  Species,
} from '@modules/animals/domain/enums/animal.enums';
import { buildPedigree, PedigreeAnimal } from './pedigree-tree';

const node = (
  id: string,
  sex: Sex,
  damId: string | null = null,
  sireId: string | null = null,
): PedigreeAnimal => ({
  id,
  earTag: id.toUpperCase(),
  name: null,
  sex,
  species: Species.SHEEP,
  birthDate: null,
  isExternal: false,
  status: AnimalStatus.ALIVE,
  geneticCategory: null,
  absidRegistry: null,
  breedName: 'Santa Inés',
  damId,
  sireId,
});

//            x
//        d       s        d y s son medio hermanos (mismo padre a)
//      b   a   c   a
//                  e       a tiene madre e (tatarabuela fuera de 2 generaciones)
const family = [
  node('x', Sex.FEMALE, 'd', 's'),
  node('d', Sex.FEMALE, 'b', 'a'),
  node('s', Sex.MALE, 'c', 'a'),
  node('a', Sex.MALE, 'e', null),
  node('b', Sex.FEMALE),
  node('c', Sex.FEMALE),
  node('e', Sex.FEMALE),
];

describe('Árbol genealógico', () => {
  it('arma el árbol hasta las generaciones pedidas', () => {
    const result = buildPedigree('x', family, 2);
    expect(result.tree.dam?.earTag).toBe('D');
    expect(result.tree.sire?.earTag).toBe('S');
    expect(result.tree.dam?.dam?.earTag).toBe('B');
    expect(result.tree.sire?.sire?.earTag).toBe('A');
    // Última generación: no trae padres, pero avisa si hay más hacia atrás.
    const a = result.tree.sire!.sire!;
    expect(a.dam).toBeUndefined();
    expect(a.hasMoreAncestors).toBe(true);
    expect(result.tree.dam!.dam!.hasMoreAncestors).toBe(false);
  });

  it('cuenta los ancestros conocidos por generación y los repetidos', () => {
    const result = buildPedigree('x', family, 3);
    expect(result.completeness).toEqual([
      { generation: 1, known: 2, possible: 2 },
      { generation: 2, known: 4, possible: 4 },
      // e aparece dos veces (madre de a, que está en las dos ramas).
      { generation: 3, known: 2, possible: 8 },
    ]);
    expect(
      result.repeatedAncestors.map((r) => [r.earTag, r.occurrences]),
    ).toEqual([
      ['A', 2],
      ['E', 2],
    ]);
    // Desconocido: null (no undefined) dentro de las generaciones pedidas.
    expect(result.tree.dam!.dam!.dam).toBeNull();
  });

  it('calcula la consanguinidad del animal: hijo de medio hermanos = 12,5 %', () => {
    const result = buildPedigree('x', family, 3);
    expect(result.inbreeding?.coefficient).toBe(0.125);
    expect(result.inbreeding?.relationship).toMatch(/medio hermanos/);
    expect(result.inbreeding?.commonAncestors.map((a) => a.earTag)).toEqual([
      'A',
    ]);
  });

  it('sin padre o madre conocidos no calcula consanguinidad', () => {
    expect(buildPedigree('d', family, 3).inbreeding).toEqual(
      expect.objectContaining({ coefficient: 0 }),
    );
    expect(buildPedigree('b', family, 3).inbreeding).toBeNull();
    expect(buildPedigree('b', family, 3).completeness[0]).toEqual({
      generation: 1,
      known: 0,
      possible: 2,
    });
  });
});
