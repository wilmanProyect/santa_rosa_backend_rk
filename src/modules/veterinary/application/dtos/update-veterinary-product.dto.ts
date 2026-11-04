import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AdministrationRoute,
  DoseUnit,
  ProductCategory,
} from '../../domain/enums/veterinary.enums';
import { MAX_WITHDRAWAL_DAYS } from '../../domain/models/veterinary-product.model';

const notNull = (_: object, value: unknown) => value !== null;

/** Solo cambian los campos enviados. Los anulables aceptan null para vaciarlos. */
export class UpdateVeterinaryProductDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(150)
  @IsOptional()
  activeIngredient?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(50)
  @IsOptional()
  concentration?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  manufacturer?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(100)
  @IsOptional()
  presentation?: string | null;

  @ApiPropertyOptional({ enum: DoseUnit, nullable: true })
  @ValidateIf(notNull)
  @IsEnum(DoseUnit)
  @IsOptional()
  doseUnit?: DoseUnit | null;

  @ApiPropertyOptional({ enum: AdministrationRoute, nullable: true })
  @ValidateIf(notNull)
  @IsEnum(AdministrationRoute)
  @IsOptional()
  defaultRoute?: AdministrationRoute | null;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(500)
  @IsOptional()
  dosageInstructions?: string | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  forSheep?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  forGoats?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_WITHDRAWAL_DAYS)
  @IsOptional()
  meatWithdrawalDays?: number;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsInt()
  @Min(0)
  @Max(MAX_WITHDRAWAL_DAYS)
  @IsOptional()
  milkWithdrawalDays?: number | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  requiresPrescription?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  requiresRefrigeration?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf(notNull)
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
