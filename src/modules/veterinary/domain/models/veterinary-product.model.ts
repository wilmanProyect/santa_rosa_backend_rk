import { UUID } from '@shared/domain/value-objects/uuid.vo';
import { DomainError } from '@shared/domain/errors/domain.error';
import { AuditInfo, newAuditInfo } from '@shared/domain/audit-info';
import {
  AdministrationRoute,
  DoseUnit,
  ProductCategory,
} from '../enums/veterinary.enums';

/** Datos editables del producto. */
export interface VeterinaryProductData {
  /** Nombre comercial. Único (sin distinguir mayúsculas). */
  name: string;
  category: ProductCategory;
  /** Principio activo, p. ej. "Ivermectina". */
  activeIngredient: string | null;
  /** Concentración, p. ej. "1 %" o "200 mg/ml". */
  concentration: string | null;
  manufacturer: string | null;
  /** Presentación, p. ej. "Frasco 100 ml". */
  presentation: string | null;
  /** Unidad en que se dosifica. */
  doseUnit: DoseUnit | null;
  defaultRoute: AdministrationRoute | null;
  /** Indicaciones de dosis, p. ej. "1 ml cada 50 kg". */
  dosageInstructions: string | null;
  forSheep: boolean;
  forGoats: boolean;
  /** Días que deben pasar desde la aplicación hasta poder faenar. */
  meatWithdrawalDays: number;
  /** Días hasta poder usar la leche (caprinos). Nulo si no aplica. */
  milkWithdrawalDays: number | null;
  requiresPrescription: boolean;
  requiresRefrigeration: boolean;
  notes: string | null;
}

export interface VeterinaryProductProps extends VeterinaryProductData {
  id: string;
  isActive: boolean;
  audit: AuditInfo;
}

export const MAX_WITHDRAWAL_DAYS = 365;

/**
 * Producto del catálogo veterinario. El stock (lotes, vencimientos y
 * movimientos) se agregará en el módulo de inventario veterinario.
 */
export class VeterinaryProduct {
  constructor(private readonly props: VeterinaryProductProps) {}

  static create(
    params: Partial<VeterinaryProductData> &
      Pick<VeterinaryProductData, 'name' | 'category'> & {
        createdBy: string | null;
      },
  ): VeterinaryProduct {
    const { createdBy, ...data } = params;
    const product = new VeterinaryProduct({
      id: new UUID().getValue(),
      name: '',
      category: data.category,
      activeIngredient: null,
      concentration: null,
      manufacturer: null,
      presentation: null,
      doseUnit: null,
      defaultRoute: null,
      dosageInstructions: null,
      forSheep: true,
      forGoats: true,
      meatWithdrawalDays: 0,
      milkWithdrawalDays: null,
      requiresPrescription: false,
      requiresRefrigeration: false,
      notes: null,
      isActive: true,
      audit: newAuditInfo(createdBy),
    });
    product.update(data);
    return product;
  }

  public getId(): string {
    return this.props.id;
  }
  public getName(): string {
    return this.props.name;
  }
  public getCategory(): ProductCategory {
    return this.props.category;
  }
  public getActiveIngredient(): string | null {
    return this.props.activeIngredient;
  }
  public getConcentration(): string | null {
    return this.props.concentration;
  }
  public getManufacturer(): string | null {
    return this.props.manufacturer;
  }
  public getPresentation(): string | null {
    return this.props.presentation;
  }
  public getDoseUnit(): DoseUnit | null {
    return this.props.doseUnit;
  }
  public getDefaultRoute(): AdministrationRoute | null {
    return this.props.defaultRoute;
  }
  public getDosageInstructions(): string | null {
    return this.props.dosageInstructions;
  }
  public getForSheep(): boolean {
    return this.props.forSheep;
  }
  public getForGoats(): boolean {
    return this.props.forGoats;
  }
  public getMeatWithdrawalDays(): number {
    return this.props.meatWithdrawalDays;
  }
  public getMilkWithdrawalDays(): number | null {
    return this.props.milkWithdrawalDays;
  }
  public getRequiresPrescription(): boolean {
    return this.props.requiresPrescription;
  }
  public getRequiresRefrigeration(): boolean {
    return this.props.requiresRefrigeration;
  }
  public getNotes(): string | null {
    return this.props.notes;
  }
  public getIsActive(): boolean {
    return this.props.isActive;
  }
  public getAudit(): AuditInfo {
    return this.props.audit;
  }

  /** Aplica solo los campos definidos. */
  public update(changes: Partial<VeterinaryProductData>): void {
    const p = this.props;
    if (changes.name !== undefined) {
      const name = (changes.name ?? '').trim().replace(/\s+/g, ' ');
      if (!name)
        throw new DomainError('El nombre del producto no puede estar vacío');
      p.name = name;
    }
    if (changes.category !== undefined) p.category = changes.category;
    if (changes.activeIngredient !== undefined) {
      p.activeIngredient = text(changes.activeIngredient);
    }
    if (changes.concentration !== undefined) {
      p.concentration = text(changes.concentration);
    }
    if (changes.manufacturer !== undefined) {
      p.manufacturer = text(changes.manufacturer);
    }
    if (changes.presentation !== undefined) {
      p.presentation = text(changes.presentation);
    }
    if (changes.doseUnit !== undefined) p.doseUnit = changes.doseUnit;
    if (changes.defaultRoute !== undefined)
      p.defaultRoute = changes.defaultRoute;
    if (changes.dosageInstructions !== undefined) {
      p.dosageInstructions = text(changes.dosageInstructions);
    }
    if (changes.forSheep !== undefined) p.forSheep = changes.forSheep;
    if (changes.forGoats !== undefined) p.forGoats = changes.forGoats;
    if (changes.meatWithdrawalDays !== undefined) {
      p.meatWithdrawalDays = changes.meatWithdrawalDays;
    }
    if (changes.milkWithdrawalDays !== undefined) {
      p.milkWithdrawalDays = changes.milkWithdrawalDays;
    }
    if (changes.requiresPrescription !== undefined) {
      p.requiresPrescription = changes.requiresPrescription;
    }
    if (changes.requiresRefrigeration !== undefined) {
      p.requiresRefrigeration = changes.requiresRefrigeration;
    }
    if (changes.notes !== undefined) p.notes = text(changes.notes);

    if (!p.forSheep && !p.forGoats) {
      throw new DomainError(
        'El producto debe estar autorizado al menos para ovinos o para caprinos',
      );
    }
    assertDays(p.meatWithdrawalDays, 'El retiro de carne');
    if (p.milkWithdrawalDays !== null) {
      assertDays(p.milkWithdrawalDays, 'El retiro de leche');
    }
  }

  public activate(): void {
    this.props.isActive = true;
  }
  public deactivate(): void {
    this.props.isActive = false;
  }
  public markUpdatedBy(actorId: string): void {
    this.props.audit.updatedBy = actorId;
  }
}

function text(value: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

function assertDays(value: number, field: string) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_WITHDRAWAL_DAYS) {
    throw new DomainError(
      `${field} debe ser un número entero de días entre 0 y ${MAX_WITHDRAWAL_DAYS}`,
    );
  }
}
