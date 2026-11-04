import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';
import {
  AdministrationRoute,
  DoseUnit,
  ProductCategory,
} from '../../domain/enums/veterinary.enums';
import { MAX_WITHDRAWAL_DAYS } from '../../domain/models/veterinary-product.model';

export class CreateVeterinaryProductDto {
  @ApiProperty({ example: 'Ivomec', description: 'Nombre comercial, único' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiProperty({
    enum: ProductCategory,
    example: ProductCategory.INTERNAL_ANTIPARASITIC,
  })
  @IsEnum(ProductCategory)
  category: ProductCategory;

  @ApiPropertyOptional({ example: 'Ivermectina' })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  activeIngredient?: string;

  @ApiPropertyOptional({ example: '1 %' })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  concentration?: string;

  @ApiPropertyOptional({ example: 'Boehringer Ingelheim' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional({ example: 'Frasco 500 ml' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  presentation?: string;

  @ApiPropertyOptional({
    enum: DoseUnit,
    description: 'Unidad de dosificación',
  })
  @IsEnum(DoseUnit)
  @IsOptional()
  doseUnit?: DoseUnit;

  @ApiPropertyOptional({ enum: AdministrationRoute })
  @IsEnum(AdministrationRoute)
  @IsOptional()
  defaultRoute?: AdministrationRoute;

  @ApiPropertyOptional({ example: '1 ml cada 50 kg de peso vivo' })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  dosageInstructions?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  forSheep?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  forGoats?: boolean;

  @ApiPropertyOptional({
    default: 0,
    description:
      'Días desde la aplicación hasta poder faenar (período de retiro de carne)',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_WITHDRAWAL_DAYS)
  @IsOptional()
  meatWithdrawalDays?: number;

  @ApiPropertyOptional({
    description: 'Días hasta poder usar la leche (caprinos)',
  })
  @IsInt()
  @Min(0)
  @Max(MAX_WITHDRAWAL_DAYS)
  @IsOptional()
  milkWithdrawalDays?: number;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  requiresPrescription?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  requiresRefrigeration?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  notes?: string;
}
