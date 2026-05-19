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
  MonthlyStatsResponseDto,
  MonthlyWeekTrendDto,
} from './dto/caffeine-stats.dto';

import { RedisService } from '../../providers/redis/redis.service';
import { PostService } from '../post/post.service';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as advancedFormat from 'dayjs/plugin/advancedFormat';
import * as isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
dayjs.extend(isoWeek);

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(
    private readonly caffeineRepository: CaffeineRepository,
    private readonly brandService: BrandService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => PostService))
    private readonly postService: PostService,
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

    const queryRunner =
      externalQueryRunner || (await this.caffeineRepository.getQueryRunner());

    if (!externalQueryRunner) {
      await queryRunner.connect();
      await queryRunner.startTransaction();
    }

    try {
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

      if (!externalQueryRunner) {
        await queryRunner.commitTransaction();
      }

      await this.invalidateCaffeineCaches(userId);
      await this.updateBrandRanking(brandId, 1);

      this.logger.log(`Intake ${intakeId} logged for user ${userId}`);
      return intakeId;
    } catch (error) {
      if (!externalQueryRunner) {
        await queryRunner.rollbackTransaction();
      }
      this.logger.error(`Failed to log intake for user ${userId}`, error);
      throw new InternalServerErrorException(
        'Failed to record caffeine intake',
      );
    } finally {
      if (!externalQueryRunner) {
        await queryRunner.release();
      }
    }
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

    const queryRunner = await this.caffeineRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.caffeineRepository.softDeleteIntake(intakeId, queryRunner);
      await this.caffeineRepository.updateUserStatsSum(
        userId,
        -intake.caffeine,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      await this.invalidateCaffeineCaches(userId, intake.created_at);
      await this.updateBrandRanking(intake.brand_id, -1, intake.created_at);

      this.logger.log(
        `Standalone intake ${intakeId} deleted for user ${userId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to delete standalone intake ${intakeId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to delete intake');
    } finally {
      await queryRunner.release();
    }
  }

  async getPostByIntakeId(intakeId: number): Promise<string | null> {
    return await this.postService.getPostByIntakeId(intakeId);
  }

  private async invalidateCaffeineCaches(
    userId: string,
    date?: Date | dayjs.Dayjs,
  ) {
    const targetDate = date
      ? dayjs(date).add(9, 'hour')
      : dayjs.utc().add(9, 'hour');

    const calendarMonthKey = targetDate.format('YYYY-MM');

    const refThursday = targetDate.startOf('isoWeek').add(3, 'day');
    const logicalMonthKey = refThursday.format('YYYY-MM');

    const currentRange = this.getLogicalMonthRange(
      refThursday.startOf('month'),
    );
    const nextLogicalMonthRef = currentRange.end.add(1, 'day');
    const nextRefThursday = nextLogicalMonthRef
      .startOf('isoWeek')
      .add(3, 'day');
    const nextLogicalMonthKey = nextRefThursday.format('YYYY-MM');

    const keys = [
      `caffeine:today:${userId}`,
      `caffeine:monthly:${userId}:${calendarMonthKey}`,
      `caffeine:monthly_stats:${userId}:${logicalMonthKey}`,
      `caffeine:monthly_stats:${userId}:${nextLogicalMonthKey}`,
      `user:profile:${userId}`,
      `user:stats:${userId}`,
    ];
    await this.redisService.del(keys);
  }

  async getTodayConsumption(userId: string): Promise<TodayCaffeineResponseDto> {
    const cacheKey = `caffeine:today:${userId}`;
    return await this.redisService.getOrSet(cacheKey, 10800, async () => {
      const fakeKSTNow = dayjs.utc().add(9, 'hour');
      const start = fakeKSTNow.startOf('day');
      const end = fakeKSTNow.endOf('day');

      const row = await this.caffeineRepository.findTodayConsumption(
        userId,
        this.formatDateForDb(start),
        this.formatDateForDb(end),
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

  async getMonthlyTrend(
    userId: string,
    dateStr?: string,
  ): Promise<MonthlyStatsResponseDto> {
    const inputDate = dateStr
      ? dayjs.utc(dateStr).add(9, 'hour')
      : dayjs.utc().add(9, 'hour');

    const refThursday = inputDate.startOf('isoWeek').add(3, 'day');
    const logicalMonthDate = refThursday.startOf('month');
    const monthKey = logicalMonthDate.format('YYYY-MM');
    const cacheKey = `caffeine:monthly_stats:${userId}:${monthKey}`;

    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const currentRange = this.getLogicalMonthRange(logicalMonthDate);

      const previousLogicalMonthRef = currentRange.start.subtract(1, 'day');
      const previousRefThursday = previousLogicalMonthRef
        .startOf('isoWeek')
        .add(3, 'day');
      const previousLogicalMonthDate = previousRefThursday.startOf('month');

      const previousRange = this.getLogicalMonthRange(previousLogicalMonthDate);

      const [currentIntakes, previousIntakes] = await Promise.all([
        this.caffeineRepository.findIntakesInRange(
          userId,
          this.formatDateForDb(currentRange.start),
          this.formatDateForDb(currentRange.end),
        ),
        this.caffeineRepository.findIntakesInRange(
          userId,
          this.formatDateForDb(previousRange.start),
          this.formatDateForDb(previousRange.end),
        ),
      ]);

      if (currentIntakes.length === 0) {
        return {
          weeks: [],
          comparison: {
            cups: this.calculateComparison(0, previousIntakes.length),
            caffeine: this.calculateComparison(
              0,
              previousIntakes.reduce((sum, i) => sum + i.caffeine, 0),
            ),
          },
        };
      }

      const weeks: MonthlyWeekTrendDto[] = [];
      let currentWeekStart = currentRange.start;
      let weekNum = 1;

      while (
        currentWeekStart.isBefore(currentRange.end) ||
        currentWeekStart.isSame(currentRange.end, 'day')
      ) {
        const currentWeekEnd = currentWeekStart.endOf('isoWeek');
        const weekIntakes = currentIntakes.filter((i) => {
          const intakeDate = dayjs(i.created_at);
          return (
            (intakeDate.isAfter(currentWeekStart) ||
              intakeDate.isSame(currentWeekStart)) &&
            (intakeDate.isBefore(currentWeekEnd) ||
              intakeDate.isSame(currentWeekEnd))
          );
        });

        weeks.push({
          weekNum,
          cups: weekIntakes.length,
          caffeineMg: weekIntakes.reduce((sum, i) => sum + i.caffeine, 0),
        });

        currentWeekStart = currentWeekStart.add(1, 'week');
        weekNum++;
      }

      const currentTotals = {
        cups: currentIntakes.length,
        caffeine: currentIntakes.reduce((sum, i) => sum + i.caffeine, 0),
      };

      const previousTotals = {
        cups: previousIntakes.length,
        caffeine: previousIntakes.reduce((sum, i) => sum + i.caffeine, 0),
      };

      return {
        weeks,
        comparison: {
          cups: this.calculateComparison(
            currentTotals.cups,
            previousTotals.cups,
          ),
          caffeine: this.calculateComparison(
            currentTotals.caffeine,
            previousTotals.caffeine,
          ),
        },
      };
    });
  }

  private getLogicalMonthRange(date: dayjs.Dayjs): {
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
  } {
    const firstDayOfMonth = date.startOf('month');
    const lastDayOfMonth = date.endOf('month');

    let firstThursday = firstDayOfMonth;
    while (firstThursday.isoWeekday() !== 4) {
      firstThursday = firstThursday.add(1, 'day');
    }

    let lastThursday = lastDayOfMonth;
    while (lastThursday.isoWeekday() !== 4) {
      lastThursday = lastThursday.subtract(1, 'day');
    }

    return {
      start: firstThursday.startOf('isoWeek'),
      end: lastThursday.endOf('isoWeek'),
    };
  }

  private calculateComparison(current: number, previous: number) {
    const diff = Math.abs(current - previous);
    let trend: 'higher' | 'lower' | 'equal' = 'equal';

    if (current > previous) trend = 'higher';
    else if (current < previous) trend = 'lower';

    return {
      currentMonth: current,
      previousMonth: previous,
      diff,
      trend,
    };
  }
  async getMonthlyView(
    userId: string,
    dateStr: string,
  ): Promise<CaffeineMonthlyViewDto> {
    const fakeKSTDate = dayjs.utc(dateStr).add(9, 'hour');
    const monthKey = fakeKSTDate.format('YYYY-MM');
    const cacheKey = `caffeine:monthly:${userId}:${monthKey}`;

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
    const base = dayjs.utc(dateStr).add(9, 'hour');
    if (!base.isValid()) throw new InternalServerErrorException('Invalid date');

    return {
      start: this.formatDateForDb(base.startOf('month')),
      end: this.formatDateForDb(base.endOf('month')),
    };
  }

  private formatDateForDb(date: Date | dayjs.Dayjs): string {
    return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
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
    const fakeKSTNow = date ? dayjs(date) : dayjs.utc().add(9, 'hour');
    const weeklyKey = `brand:ranking:weekly:${fakeKSTNow.format('GGGG-WW')}`;
    const allKey = 'brand:ranking:all';

    return { allKey, weeklyKey };
  }
}
