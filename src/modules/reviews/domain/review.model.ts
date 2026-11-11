import { randomUUID } from 'node:crypto';
import { DomainError } from '@shared/domain/errors/domain.error';

export enum ReviewStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
}

export enum ReviewCategory {
  /** Madre o padre dudoso o faltante. */
  PARENTAGE = 'PARENTAGE',
  /** Falta un registro: una cría, un parto o una monta. */
  MISSING_RECORD = 'MISSING_RECORD',
  /** Fechas incoherentes: gestación, intervalo entre partos, nacimiento. */
  DATES = 'DATES',
  /** Arete o registro repetido o mal escrito. */
  IDENTIFIER = 'IDENTIFIER',
  OTHER = 'OTHER',
}

/** Registros a los que se puede asociar un aviso. */
export enum ReviewEntityType {
  ANIMAL = 'ANIMAL',
  BIRTH = 'BIRTH',
  BREEDING_SERVICE = 'BREEDING_SERVICE',
}

export interface ReviewTarget {
  entityType: ReviewEntityType;
  entityId: string;
  /** Papel del registro en el aviso, por ejemplo "Cría" o "Madre según la planilla". */
  role: string | null;
}

export interface ReviewProps {
  id: string;
  category: ReviewCategory;
  message: string;
  source: string | null;
  status: ReviewStatus;
  resolution: string | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  targets: ReviewTarget[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

/**
 * Aviso de revisión de datos: un problema detectado (por ejemplo, al cruzar una
 * planilla con el sistema) que el personal debe verificar y corregir. Se muestra
 * en la ficha de cada registro asociado hasta que alguien lo marca como corregido.
 */
export class DataReview {
  private constructor(private props: ReviewProps) {}

  static create(params: {
    category: ReviewCategory;
    message: string;
    source?: string | null;
    targets: ReviewTarget[];
    createdBy: string;
  }): DataReview {
    if (params.targets.length === 0) {
      throw new DomainError(
        'El aviso debe estar asociado al menos a un registro',
      );
    }
    const keys = new Set(
      params.targets.map((t) => `${t.entityType}:${t.entityId}`),
    );
    if (keys.size !== params.targets.length) {
      throw new DomainError('El aviso tiene registros repetidos');
    }
    const now = new Date();
    return new DataReview({
      id: randomUUID(),
      category: params.category,
      message: params.message.trim(),
      source: params.source?.trim() || null,
      status: ReviewStatus.OPEN,
      resolution: null,
      resolvedAt: null,
      resolvedBy: null,
      targets: params.targets,
      createdAt: now,
      createdBy: params.createdBy,
      updatedAt: now,
      updatedBy: params.createdBy,
    });
  }

  static restore(props: ReviewProps): DataReview {
    return new DataReview(props);
  }

  resolve(actorId: string, resolution: string, now = new Date()): void {
    if (this.props.status === ReviewStatus.RESOLVED) {
      throw new DomainError('El aviso ya está marcado como corregido');
    }
    this.props.status = ReviewStatus.RESOLVED;
    this.props.resolution = resolution.trim();
    this.props.resolvedAt = now;
    this.props.resolvedBy = actorId;
    this.props.updatedBy = actorId;
  }

  reopen(actorId: string): void {
    if (this.props.status === ReviewStatus.OPEN) {
      throw new DomainError('El aviso ya está pendiente');
    }
    this.props.status = ReviewStatus.OPEN;
    this.props.resolution = null;
    this.props.resolvedAt = null;
    this.props.resolvedBy = null;
    this.props.updatedBy = actorId;
  }

  toProps(): Readonly<ReviewProps> {
    return this.props;
  }

  getId(): string {
    return this.props.id;
  }
}
