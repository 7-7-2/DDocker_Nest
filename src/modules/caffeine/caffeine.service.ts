import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { CreateCaffeineDto } from './dto/create-caffeine.dto';
import { CaffeineRepository } from './caffeine.repository';
import { BrandService } from '../brand/brand.service';
import {
  CaffeineMonthlyViewDto,
  CaffeineDetailItemDto,
  CaffeineSummaryItemDto,
} from './dto/caffeine-calendar.dto';
import {
  TodayCaffeineItemDto,
  TodayCaffeineResponseDto,
} from './dto/caffeine-stats.dto';
import { IntakeTrendResponseDto } from './dto/intake-trend.dto';
import {
  IntakeTrendBuilder,
  createIntakeTrendContext,
} from './intake-trend.builder';

import { RedisService } from '../../providers/redis/redis.service';
import { PostService } from '../post/post.service';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import { DateUtil } from '../../common/utils/date.util';
import { TransactionManager } from '../../common/database/transaction.manager';

import dayjs from 'dayjs';

/**
 * Wrapper type used to circumvent ESM modules circular dependency issue
 * caused by reflection metadata saving the type of the property.
 */
export type WrapperType<T> = T; // WrapperType === Relation

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(
    private readonly caffeineRepository: CaffeineRepository,
    private readonly brandService: BrandService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => PostService))
    private readonly postService: WrapperType<PostService>,
    private readonly txManager: TransactionManager,
  ) {}

  async logIntake(
    userId: string,
    dto: CreateCaffeineDto,
    externalQueryRunner?: QueryRunner,
  ): Promise<number> {
    const brandId = await this.brandService.resolveBrandId(dto.brandId);
    if (!brandId) {
      throw new BadRequestException(`Invalid brand: ${dto.brandId}`);
    }

    if (externalQueryRunner) {
      return await this.performLogIntake(
        userId,
        dto,
        brandId,
        externalQueryRunner,
      );
    }

    return await this.txManager.run(
      async (queryRunner) => {
        return await this.performLogIntake(userId, dto, brandId, queryRunner);
      },
      {
        logger: this.logger,
        context: 'logIntake',
        message: 'Failed to record caffeine intake',
      },
    );
  }

  private async performLogIntake(
    userId: string,
    dto: CreateCaffeineDto,
    brandId: number,
    queryRunner: QueryRunner,
  ): Promise<number> {
    const intakeId = await this.caffeineRepository.insertIntake(
      {
        user_id: userId,
        brand_id: brandId,
        caffeine: dto.caffeine,
        size: dto.size,
        shot: dto.shot ?? 0,
        intensity: dto.intensity ?? '기본',
        product_name: dto.productName,
      },
      queryRunner,
    );

    await this.caffeineRepository.updateUserStatsSum(
      userId,
      dto.caffeine,
      queryRunner,
    );

    await this.invalidateCaffeineCaches(userId);
    await this.updateBrandRanking(brandId, 1);

    this.logger.log(`Intake ${intakeId} logged for user ${userId}`);
    return intakeId;
  }

  async deleteIntake(userId: string, intakeId: number): Promise<void> {
    const intake = await this.caffeineRepository.findById(intakeId);
    if (!intake) {
      throw new NotFoundException('Intake record not found');
    }

    if (intake.user_id !== userId) {
      throw new UnauthorizedException('Unauthorized intake deletion');
    }

    const postId = await this.postService.getPostByIntakeId(intakeId);

    if (postId) {
      return await this.postService.deletePost(userId, postId);
    }

    await this.txManager.run(
      async (queryRunner) => {
        await this.caffeineRepository.softDeleteIntake(intakeId, queryRunner);
        await this.caffeineRepository.updateUserStatsSum(
          userId,
          -intake.caffeine,
          queryRunner,
        );
      },
      {
        logger: this.logger,
        context: 'deleteIntake',
        message: 'Failed to delete intake',
      },
    );

    await this.invalidateCaffeineCaches(userId, intake.created_at);
    await this.updateBrandRanking(intake.brand_id, -1, intake.created_at);

    this.logger.log(`Standalone intake ${intakeId} deleted for user ${userId}`);
  }

  async getPostByIntakeId(intakeId: number): Promise<string | null> {
    return await this.postService.getPostByIntakeId(intakeId);
  }

  private async invalidateCaffeineCaches(
    userId: string,
    date?: Date | dayjs.Dayjs,
  ) {
    const targetDate = date ? DateUtil.toKst(date) : DateUtil.nowKst();

    const calendarMonthKey = DateUtil.getMonthKey(targetDate);

    const keys = [
      REDIS_KEYS.CAFFEINE.TODAY(userId),
      REDIS_KEYS.CAFFEINE.MONTHLY(userId, calendarMonthKey),
      REDIS_KEYS.USER.PROFILE(userId),
      REDIS_KEYS.USER.STATS(userId),
    ];
    await this.redisService.del(keys);
  }

  async getTodayConsumption(userId: string): Promise<TodayCaffeineResponseDto> {
    const cacheKey = REDIS_KEYS.CAFFEINE.TODAY(userId);
    return await this.redisService.getOrSet(cacheKey, 10800, async () => {
      const fakeKSTNow = DateUtil.nowKst();
      const { start, end } = DateUtil.getDayRange(fakeKSTNow);

      const row = await this.caffeineRepository.findTodayConsumption(
        userId,
        DateUtil.formatForDb(start),
        DateUtil.formatForDb(end),
      );

      if (!row) {
        return { todayCaffeine: 0, todayCups: 0, items: [] };
      }

      return {
        todayCaffeine: row.caffeine_sum ? Number(row.caffeine_sum) : 0,
        todayCups: Number(row.cup_count),
        items: this.parseItems(row.items),
      };
    });
  }

  async getIntakeTrend(
    userId: string,
    dateStr: string,
    unit: 'weekly' | 'monthly',
  ): Promise<IntakeTrendResponseDto> {
    const anchor = DateUtil.toKst(dateStr);
    const dayKey = DateUtil.getDayKey(anchor);
    const cacheKey = REDIS_KEYS.CAFFEINE.ANALYSIS(userId, unit, dayKey);

    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const context = createIntakeTrendContext(anchor, unit);

      const globalStart = context.chartRanges[0].start;
      const globalEnd = context.currentRange.end;

      const allIntakes =
        await this.caffeineRepository.findDetailedIntakesInRange(
          userId,
          DateUtil.formatForDb(globalStart),
          DateUtil.formatForDb(globalEnd),
        );

      const currentIntakes = allIntakes.filter((i) => {
        const d = DateUtil.toKst(i.created_at);
        return (
          (d.isAfter(context.currentRange.start) ||
            d.isSame(context.currentRange.start)) &&
          (d.isBefore(context.currentRange.end) ||
            d.isSame(context.currentRange.end))
        );
      });

      return new IntakeTrendBuilder(context, currentIntakes, allIntakes)
        .buildChart()
        .buildMetrics()
        .buildThresholds()
        .buildRankings()
        .getResult();
    });
  }

  private parseItems(items: unknown): TodayCaffeineItemDto[] {
    if (!items) return [];

    try {
      if (Array.isArray(items)) {
        return items as TodayCaffeineItemDto[];
      }

      if (typeof items === 'string') {
        const parsed: unknown = JSON.parse(items);
        return Array.isArray(parsed) ? (parsed as TodayCaffeineItemDto[]) : [];
      }
    } catch (error) {
      this.logger.error('Failed to parse today consumption items', error);
    }

    return [];
  }

  async getMonthlyView(
    userId: string,
    dateStr: string,
  ): Promise<CaffeineMonthlyViewDto> {
    const fakeKSTDate = DateUtil.toKst(dateStr);
    const monthKey = DateUtil.getMonthKey(fakeKSTDate);
    const cacheKey = REDIS_KEYS.CAFFEINE.MONTHLY(userId, monthKey);

    return await this.redisService.getOrSet(cacheKey, 86400, async () => {
      const { start, end } = this.getMonthRange(dateStr);
      const rows = await this.caffeineRepository.findMonthlyDetails(
        userId,
        start,
        end,
      );

      const details: Record<string, CaffeineDetailItemDto[]> = {};
      const sumsMap: Record<number, number> = {};

      rows.forEach((row) => {
        const dayKey = row.day.toString();
        if (!details[dayKey]) details[dayKey] = [];
        details[dayKey].push({
          intakeId: row.id,
          brand: row.brand_name,
          caffeine: row.caffeine,
          productName: row.product_name,
          intensity: row.intensity,
          shot: row.shot,
          size: row.size,
        });
        sumsMap[row.day] = (sumsMap[row.day] || 0) + row.caffeine;
      });

      const summary: CaffeineSummaryItemDto[] = Object.keys(sumsMap)
        .map((day) => parseInt(day, 10))
        .sort((a, b) => a - b)
        .map((day) => ({ day, caffeineSum: sumsMap[day] }));

      return { summary, details };
    });
  }

  private getMonthRange(dateStr: string): { start: string; end: string } {
    const base = DateUtil.toKst(dateStr);
    if (!base.isValid()) throw new InternalServerErrorException('Invalid date');

    return {
      start: DateUtil.formatForDb(base.startOf('month')),
      end: DateUtil.formatForDb(base.endOf('month')),
    };
  }

  async updateBrandRanking(
    brandId: number,
    increment: number,
    date?: Date | dayjs.Dayjs,
  ) {
    const { allKey, weeklyKey } = this.getBrandRankingKeys(date);

    try {
      await this.redisService.zincrby(allKey, increment, brandId);
      await this.redisService.zincrby(weeklyKey, increment, brandId);
      await this.redisService.expire(weeklyKey, 14 * 24 * 3600);
    } catch (error) {
      this.logger.error(
        `Failed to update brand ranking for brand ${brandId}`,
        error,
      );
    }
  }

  private getBrandRankingKeys(date?: Date | dayjs.Dayjs) {
    const fakeKSTNow = date ? DateUtil.toKst(date) : DateUtil.nowKst();
    const weeklyKey = REDIS_KEYS.BRAND.RANKING_WEEKLY(
      fakeKSTNow.format('GGGG-WW'),
    );
    const allKey = REDIS_KEYS.BRAND.RANKING_ALL;

    return { allKey, weeklyKey };
  }
}
