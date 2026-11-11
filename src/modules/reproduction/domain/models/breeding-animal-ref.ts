import { GeneticCategory } from '@modules/animals/domain/enums/animal.enums';
import { Animal } from '@modules/animals/domain/models/animal.model';

/** Datos de la madre o el padre que se muestran junto a la monta o el parto. */
export interface BreedingAnimalRef {
  id: string;
  earTag: string | null;
  name: string | null;
  isExternal: boolean;
  geneticCategory: GeneticCategory | null;
}

export const toBreedingRef = (animal: Animal): BreedingAnimalRef => ({
  id: animal.getId(),
  earTag: animal.getEarTag(),
  name: animal.getName(),
  isExternal: animal.getIsExternal(),
  geneticCategory: animal.getGeneticCategory(),
});

export const describeAnimal = (ref: {
  id: string;
  earTag: string | null;
  name: string | null;
}) => ref.earTag ?? ref.name ?? ref.id;
