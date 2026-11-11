import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@modules/roles-permissions/domain/permission-catalog';
import { RequirePermissions } from '@modules/auth/infrastructure/decorators/require-permissions.decorator';
import { CurrentUser } from '@modules/auth/infrastructure/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@modules/auth/domain/authenticated-user';
import {
  ReviewsService,
  type ReviewView,
} from '../application/reviews.service';
import {
  CreateReviewDto,
  ListReviewsQueryDto,
  OpenTargetsQueryDto,
  ResolveReviewDto,
} from '../application/review.dto';

@ApiTags('Revisión de datos')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.REVIEWS_READ)
  @ApiOperation({
    summary:
      'Avisos de revisión (pendientes primero). Con entityType y entityId, los de un registro',
  })
  async list(@Query() query: ListReviewsQueryDto) {
    const page = await this.reviews.list(query);
    return { ...page, items: page.items.map(present) };
  }

  @Get('open-targets')
  @RequirePermissions(PERMISSIONS.REVIEWS_READ)
  @ApiOperation({
    summary:
      'Registros de un tipo con avisos pendientes, para marcarlos en los listados',
  })
  async openTargets(@Query() query: OpenTargetsQueryDto) {
    return {
      entityType: query.entityType,
      totalOpen: await this.reviews.countOpen(),
      items: await this.reviews.openTargets(query.entityType),
    };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.REVIEWS_READ)
  @ApiOperation({ summary: 'Detalle de un aviso de revisión' })
  async get(@Param('id', ParseUUIDPipe) id: string) {
    return present(await this.reviews.get(id));
  }

  @Post()
  @RequirePermissions(PERMISSIONS.REVIEWS_CREATE)
  @ApiOperation({
    summary:
      'Crear un aviso de revisión sobre uno o más animales, partos o montas',
  })
  async create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return present(await this.reviews.create(actor.id, dto));
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.REVIEWS_RESOLVE)
  @ApiOperation({
    summary: 'Marcar el aviso como corregido, indicando qué se hizo',
  })
  async resolve(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReviewDto,
  ) {
    return present(await this.reviews.resolve(actor.id, id, dto));
  }

  @Post(':id/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.REVIEWS_RESOLVE)
  @ApiOperation({ summary: 'Volver a dejar pendiente un aviso corregido' })
  async reopen(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return present(await this.reviews.reopen(actor.id, id));
  }
}

function present({ review, targets }: ReviewView) {
  const p = review.toProps();
  return {
    id: p.id,
    category: p.category,
    message: p.message,
    source: p.source,
    status: p.status,
    resolution: p.resolution,
    resolvedAt: p.resolvedAt,
    resolvedBy: p.resolvedBy,
    targets: p.targets.map((t, i) => ({
      entityType: t.entityType,
      entityId: t.entityId,
      role: t.role,
      label: targets[i].label,
      exists: targets[i].exists,
    })),
    createdAt: p.createdAt,
    createdBy: p.createdBy,
    updatedAt: p.updatedAt,
    updatedBy: p.updatedBy,
  };
}
