import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '@shared/application/dtos/pagination-query.dto';
import {
  ReviewCategory,
  ReviewEntityType,
  ReviewStatus,
} from '../domain/review.model';

export class ReviewTargetDto {
  @ApiProperty({ enum: ReviewEntityType })
  @IsEnum(ReviewEntityType)
  entityType: ReviewEntityType;

  @ApiProperty()
  @IsUUID()
  entityId: string;

  @ApiPropertyOptional({ example: 'Madre según la planilla', maxLength: 60 })
  @IsString()
  @MaxLength(60)
  @IsOptional()
  role?: string;
}

export class CreateReviewDto {
  @ApiProperty({ enum: ReviewCategory })
  @IsEnum(ReviewCategory)
  category: ReviewCategory;

  @ApiProperty({ minLength: 10, maxLength: 1000 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({ example: 'Planilla de montas', maxLength: 150 })
  @IsString()
  @MaxLength(150)
  @IsOptional()
  source?: string;

  @ApiProperty({ type: [ReviewTargetDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ReviewTargetDto)
  targets: ReviewTargetDto[];
}

export class ResolveReviewDto {
  @ApiProperty({
    description: 'Qué se corrigió o por qué no había que corregir nada',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(1000)
  resolution: string;
}

export class ListReviewsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  @ApiPropertyOptional({ enum: ReviewCategory })
  @IsEnum(ReviewCategory)
  @IsOptional()
  category?: ReviewCategory;

  @ApiPropertyOptional({ enum: ReviewEntityType })
  @IsEnum(ReviewEntityType)
  @IsOptional()
  entityType?: ReviewEntityType;

  @ApiPropertyOptional({ description: 'Avisos asociados a este registro' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({ description: 'Busca en el texto del aviso' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  search?: string;
}

export class OpenTargetsQueryDto {
  @ApiProperty({ enum: ReviewEntityType })
  @IsEnum(ReviewEntityType)
  entityType: ReviewEntityType;
}
