import { Sex, Species } from '../enums/animal.enums';

/** Datos mínimos de la madre o el padre, suficientes para validar la genealogía. */
export interface AnimalParent {
  id: string;
  earTag: string | null;
  name: string | null;
  species: Species;
  sex: Sex;
  /** YYYY-MM-DD */
  birthDate: string | null;
  isExternal: boolean;
}
