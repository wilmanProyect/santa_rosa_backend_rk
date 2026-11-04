import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BooleanQuery } from '@shared/application/transformers/boolean-query.transformer';
import { ProductCategory } from '../../domain/enums/veterinary.enums';

export class ListVeterinaryProductsQueryDto {
  @ApiPropertyOptional({
    description: 'Busca en nombre, principio activo y laboratorio',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: ProductCategory })
  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @ApiPropertyOptional()
  @BooleanQuery()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
