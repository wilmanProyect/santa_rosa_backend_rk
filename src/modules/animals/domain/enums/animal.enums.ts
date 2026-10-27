export enum Species {
  /** Ovino */
  SHEEP = 'SHEEP',
  /** Caprino */
  GOAT = 'GOAT',
}

export enum Sex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

/** Estado del animal. Solo los ALIVE forman parte del inventario. */
export enum AnimalStatus {
  /** Vivo, en la cabaña */
  ALIVE = 'ALIVE',
  /** Muerto */
  DEAD = 'DEAD',
  /** Vendido */
  SOLD = 'SOLD',
  /** Faenado */
  SLAUGHTERED = 'SLAUGHTERED',
  /** Regalado */
  GIFTED = 'GIFTED',
}

/** Cómo ingresó el animal a la cabaña. */
export enum EntryOrigin {
  /** Nacido en la cabaña */
  BORN_ON_FARM = 'BORN_ON_FARM',
  /** Comprado a otra cabaña */
  PURCHASE = 'PURCHASE',
  /** Recibido en donación */
  DONATION = 'DONATION',
  /** Recibido como regalo */
  GIFT = 'GIFT',
}

/** Categoría genética según ABSID. */
export enum GeneticCategory {
  /** Comercial / General */
  COMMERCIAL = 'COMMERCIAL',
  BASE = 'BASE',
  G1 = 'G1',
  G2 = 'G2',
  G3 = 'G3',
  G4 = 'G4',
  /** Puro de origen */
  PO = 'PO',
}
