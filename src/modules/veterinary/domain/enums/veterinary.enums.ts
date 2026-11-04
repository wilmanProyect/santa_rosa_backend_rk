export enum ProductCategory {
  /** Vacuna */
  VACCINE = 'VACCINE',
  /** Antiparasitario interno (desparasitante) */
  INTERNAL_ANTIPARASITIC = 'INTERNAL_ANTIPARASITIC',
  /** Antiparasitario externo (baños, pour-on) */
  EXTERNAL_ANTIPARASITIC = 'EXTERNAL_ANTIPARASITIC',
  /** Antibiótico */
  ANTIBIOTIC = 'ANTIBIOTIC',
  /** Antiinflamatorio / analgésico */
  ANTI_INFLAMMATORY = 'ANTI_INFLAMMATORY',
  /** Vitaminas y minerales */
  VITAMIN_MINERAL = 'VITAMIN_MINERAL',
  /** Desinfectante (corrales, heridas) */
  DISINFECTANT = 'DISINFECTANT',
  /** Otro */
  OTHER = 'OTHER',
}

/** Unidad en que se mide una dosis. */
export enum DoseUnit {
  /** Mililitros (= cc) */
  ML = 'ML',
  /** Gramos */
  G = 'G',
  /** Miligramos */
  MG = 'MG',
  /** Comprimido / bolo */
  TABLET = 'TABLET',
  /** Dosis (p. ej. vacunas que se miden por dosis) */
  DOSE = 'DOSE',
}

/** Vía de administración. */
export enum AdministrationRoute {
  ORAL = 'ORAL',
  SUBCUTANEOUS = 'SUBCUTANEOUS',
  INTRAMUSCULAR = 'INTRAMUSCULAR',
  INTRAVENOUS = 'INTRAVENOUS',
  TOPICAL = 'TOPICAL',
  INTRANASAL = 'INTRANASAL',
  POUR_ON = 'POUR_ON',
  /** Baño o aspersión */
  IMMERSION = 'IMMERSION',
}
