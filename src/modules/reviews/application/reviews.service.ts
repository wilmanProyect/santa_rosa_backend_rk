import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Paginated } from '@shared/domain/paginated';
import { DataReview, ReviewEntityType } from '../domain/review.model';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
  type ReviewTargetSummary,
} from '../domain/review.repository.interface';
import type {
  CreateReviewDto,
  ListReviewsQueryDto,
  ResolveReviewDto,
} from './review.dto';

export interface ReviewView {
  review: DataReview;
  targets: ReviewTargetSummary[];
}

const ENTITY_LABEL: Record<ReviewEntityType, string> = {
  [ReviewEntityType.ANIMAL]: 'animal',
  [ReviewEntityType.BIRTH]: 'parto',
  [ReviewEntityType.BREEDING_SERVICE]: 'monta',
};

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: IReviewRepository,
  ) {}

  async list(query: ListReviewsQueryDto): Promise<Paginated<ReviewView>> {
    const page = await this.reviews.findPaginated(
      {
        status: query.status,
        category: query.category,
        entityType: query.entityType,
        entityId: query.entityId,
        search: query.search?.trim() || undefined,
      },
      { page: query.page, limit: query.limit },
    );
    const summaries = await this.reviews.describeTargets(
      page.items.flatMap((r) => r.toProps().targets),
    );
    const byKey = new Map(
      summaries.map((s) => [`${s.entityType}:${s.entityId}`, s]),
    );
    return {
      ...page,
      items: page.items.map((review) => ({
        review,
        targets: review
          .toProps()
          .targets.map((t) => byKey.get(`${t.entityType}:${t.entityId}`)!),
      })),
    };
  }

  async get(id: string): Promise<ReviewView> {
    const review = await this.find(id);
    return this.view(review);
  }

  async create(actorId: string, dto: CreateReviewDto): Promise<ReviewView> {
    const targets = dto.targets.map((t) => ({
      entityType: t.entityType,
      entityId: t.entityId,
      role: t.role?.trim() || null,
    }));
    const missing = await this.reviews.findMissingTargets(targets);
    if (missing.length > 0) {
      throw new BadRequestException(
        `No existe: ${missing.map((m) => `${ENTITY_LABEL[m.entityType]} ${m.entityId}`).join(', ')}`,
      );
    }
    const review = DataReview.create({
      category: dto.category,
      message: dto.message,
      source: dto.source,
      targets,
      createdBy: actorId,
    });
    await this.reviews.save(review);
    return this.view(review);
  }

  async resolve(
    actorId: string,
    id: string,
    dto: ResolveReviewDto,
  ): Promise<ReviewView> {
    const review = await this.find(id);
    review.resolve(actorId, dto.resolution);
    await this.reviews.save(review);
    return this.view(review);
  }

  async reopen(actorId: string, id: string): Promise<ReviewView> {
    const review = await this.find(id);
    review.reopen(actorId);
    await this.reviews.save(review);
    return this.view(review);
  }

  openTargets(entityType: ReviewEntityType) {
    return this.reviews.openTargetCounts(entityType);
  }

  countOpen(): Promise<number> {
    return this.reviews.countOpen();
  }

  private async find(id: string): Promise<DataReview> {
    const review = await this.reviews.findById(id);
    if (!review) throw new NotFoundException('Aviso de revisión no encontrado');
    return review;
  }

  private async view(review: DataReview): Promise<ReviewView> {
    return {
      review,
      targets: await this.reviews.describeTargets(review.toProps().targets),
    };
  }
}
