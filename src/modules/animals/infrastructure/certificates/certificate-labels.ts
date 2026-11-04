import {
  AdministrationRoute,
  DoseUnit,
} from '@modules/veterinary/domain/enums/veterinary.enums';
import {
  AnimalStatus,
  EntryOrigin,
  GeneticCategory,
  Sex,
  Species,
} from '../../domain/enums/animal.enums';
import { WeighingType } from '../../domain/models/animal-weighing.model';
import { HealthEventType } from '../../domain/models/health-record.model';

/** Textos en español de los valores fijos, para el certificado impreso. */
export const SPECIES_LABEL: Record<Species, string> = {
  [Species.SHEEP]: 'Ovino',
  [Species.GOAT]: 'Caprino',
};

export const SEX_LABEL: Record<Sex, string> = {
  [Sex.MALE]: 'Macho',
  [Sex.FEMALE]: 'Hembra',
};

export const STATUS_LABEL: Record<AnimalStatus, string> = {
  [AnimalStatus.ALIVE]: 'Vivo (en la cabaña)',
  [AnimalStatus.DEAD]: 'Muerto',
  [AnimalStatus.SOLD]: 'Vendido',
  [AnimalStatus.SLAUGHTERED]: 'Faenado',
  [AnimalStatus.GIFTED]: 'Regalado',
  [AnimalStatus.EXCHANGED]: 'Intercambiado',
  [AnimalStatus.LOST]: 'Perdido',
};

export const ENTRY_ORIGIN_LABEL: Record<EntryOrigin, string> = {
  [EntryOrigin.BORN_ON_FARM]: 'Nacido en la cabaña',
  [EntryOrigin.PURCHASE]: 'Comprado',
  [EntryOrigin.DONATION]: 'Donación',
  [EntryOrigin.GIFT]: 'Regalo',
  [EntryOrigin.INITIAL_STOCK]: 'Inventario inicial',
};

export const GENETIC_CATEGORY_LABEL: Record<GeneticCategory, string> = {
  [GeneticCategory.COMMERCIAL]: 'Comercial / General',
  [GeneticCategory.BASE]: 'Base',
  [GeneticCategory.G1]: 'Grado 1 (G1)',
  [GeneticCategory.G2]: 'Grado 2 (G2)',
  [GeneticCategory.G3]: 'Grado 3 (G3)',
  [GeneticCategory.G4]: 'Grado 4 (G4)',
  [GeneticCategory.PO]: 'Puro de origen (PO)',
};

/** Grado de pureza por categoría (cruzamiento absorbente); sin dato en Base y Comercial. */
export const PURITY_LABEL: Partial<Record<GeneticCategory, string>> = {
  [GeneticCategory.G1]: '50 %',
  [GeneticCategory.G2]: '75 %',
  [GeneticCategory.G3]: '87,5 %',
  [GeneticCategory.G4]: '93,75 %',
  [GeneticCategory.PO]: '100 %',
};

export const WEIGHING_TYPE_LABEL: Record<WeighingType, string> = {
  [WeighingType.BIRTH]: 'Nacimiento',
  [WeighingType.WEANING]: 'Destete',
  [WeighingType.ROUTINE]: 'Control',
  [WeighingType.SELECTION]: 'Selección',
  [WeighingType.ENTRY]: 'Ingreso',
  [WeighingType.SALE]: 'Venta',
  [WeighingType.OTHER]: 'Otro',
};

export const HEALTH_TYPE_LABEL: Record<HealthEventType, string> = {
  [HealthEventType.VACCINATION]: 'Vacunación',
  [HealthEventType.INTERNAL_DEWORMING]: 'Desparasitación interna',
  [HealthEventType.EXTERNAL_DEWORMING]: 'Desparasitación externa',
  [HealthEventType.VITAMINS_MINERALS]: 'Vitaminas y minerales',
  [HealthEventType.TREATMENT]: 'Tratamiento',
  [HealthEventType.DIAGNOSIS]: 'Diagnóstico',
  [HealthEventType.SHEARING]: 'Esquila',
  [HealthEventType.HOOF_TRIMMING]: 'Corte de pezuñas',
  [HealthEventType.OTHER_PROCEDURE]: 'Otro procedimiento',
  [HealthEventType.CORRAL_CLEANING]: 'Limpieza de corral',
};

export const DOSE_UNIT_LABEL: Record<DoseUnit, string> = {
  [DoseUnit.ML]: 'ml',
  [DoseUnit.G]: 'g',
  [DoseUnit.MG]: 'mg',
  [DoseUnit.TABLET]: 'comp.',
  [DoseUnit.DOSE]: 'dosis',
};

export const ROUTE_LABEL: Record<AdministrationRoute, string> = {
  [AdministrationRoute.ORAL]: 'Oral',
  [AdministrationRoute.SUBCUTANEOUS]: 'Subcutánea',
  [AdministrationRoute.INTRAMUSCULAR]: 'Intramuscular',
  [AdministrationRoute.INTRAVENOUS]: 'Intravenosa',
  [AdministrationRoute.TOPICAL]: 'Tópica',
  [AdministrationRoute.INTRANASAL]: 'Intranasal',
  [AdministrationRoute.POUR_ON]: 'Pour-on',
  [AdministrationRoute.IMMERSION]: 'Baño / aspersión',
};
