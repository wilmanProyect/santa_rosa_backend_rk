import { Animal } from '../../domain/models/animal.model';
import { AnimalWeighing } from '../../domain/models/animal-weighing.model';
import { HealthRecord } from '../../domain/models/health-record.model';
import type { WeightSummary } from '../../domain/repositories/animal-weighing.repository.interface';
import type { AnimalWithdrawal } from '../use-cases/health/health-record.service';

/** Un antepasado en la genealogía. null si no se conoce o fue eliminado. */
export interface PedigreeNode {
  animal: Animal;
  sire: Animal | null;
  dam: Animal | null;
}

/** Datos de la cabaña impresos en el certificado (variables FARM_*). */
export interface CertificateFarm {
  name: string;
  /** Código de la cabaña en la asociación. */
  code: string | null;
  /** Criadores responsables: firman el certificado. */
  breeders: string[];
  locality: string | null;
  phone: string | null;
  /** Pie de página, p. ej. "Santa Cruz - Bolivia". */
  region: string | null;
}

/** Todo lo que se imprime en el certificado del animal. */
export interface AnimalCertificateData {
  /** Número único de este certificado (cada emisión genera uno nuevo). */
  number: string;
  farm: CertificateFarm;
  /** Zona horaria para mostrar la fecha y hora de emisión. */
  timeZone: string;
  issuedAt: Date;
  issuedBy: { username: string; fullName: string };

  animal: Animal;
  /** Foto principal ya convertida a JPEG, o null si no tiene. */
  photoJpeg: Buffer | null;
  photoTakenAt: string | null;

  sire: PedigreeNode | null;
  dam: PedigreeNode | null;
  offspringCount: number;

  weights: WeightSummary;
  /** Pesajes más recientes primero (máx. CERTIFICATE_MAX_ROWS). */
  weighings: AnimalWeighing[];
  totalWeighings: number;

  /** Eventos sanitarios y de manejo, más recientes primero (máx. CERTIFICATE_MAX_ROWS). */
  healthRecords: HealthRecord[];
  totalHealthRecords: number;
  withdrawal: AnimalWithdrawal;
}

/** Cantidad máxima de filas por tabla del historial en el certificado. */
export const CERTIFICATE_MAX_ROWS = 15;

/** Genera el documento del certificado (PDF). */
export interface IAnimalCertificateRenderer {
  render(data: AnimalCertificateData): Promise<Buffer>;
}

export const ANIMAL_CERTIFICATE_RENDERER = Symbol('IAnimalCertificateRenderer');
