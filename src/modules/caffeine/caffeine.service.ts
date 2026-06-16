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
  PeriodicStatsItemDto,
  CaffeineIntakeRangeRow,
} from './dto/caffeine-stats.dto';
import { IntakeTrendResponseDto } from './dto/intake-trend.dto';

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
    const dayKey = targetDate.format('YYYY-MM-DD');

    const keys = [
      `caffeine:today:${userId}`,
      `caffeine:monthly:${userId}:${calendarMonthKey}`,
      `caffeine:stats:chart:${userId}:${dayKey}`,
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

  //TODO: split with helper funcs
  async getIntakeTrend(
    userId: string,
    dateStr: string,
    unit: 'weekly' | 'monthly',
  ): Promise<IntakeTrendResponseDto> {
    const anchor = dayjs.utc(dateStr).add(9, 'hour');
    const dayKey = anchor.format('YYYY-MM-DD');
    const cacheKey = `caffeine:analysis:${userId}:${unit}:${dayKey}`;

    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const ranges =
        unit === 'weekly'
          ? this.getRollingWeekRanges(anchor)
          : this.getRollingMonthRanges(anchor);

      const globalStart = ranges[0].start;
      const globalEnd = anchor.endOf(unit === 'weekly' ? 'isoWeek' : 'month');

      const intakes = await this.caffeineRepository.findDetailedIntakesInRange(
        userId,
        this.formatDateForDb(globalStart),
        this.formatDateForDb(globalEnd),
      );

      const chart = this.aggregatePeriodicStats(
        ranges,
        intakes,
        unit === 'weekly' ? 'MM.DD - MM.DD' : 'YYYY.MM',
      );

      const currentRange = ranges[ranges.length - 1];
      const currentIntakes = intakes.filter((i) => {
        const d = dayjs(i.created_at);
        return (
          (d.isAfter(currentRange.start) || d.isSame(currentRange.start)) &&
          (d.isBefore(currentRange.end) || d.isSame(currentRange.end))
        );
      });

      const dailySumMap: Record<string, number> = {};
      const brandMap: Record<
        string,
        { brand: string; cups: number; caffeine: number }
      > = {};

      currentIntakes.forEach((i) => {
        const day = dayjs(i.created_at).format('YYYY-MM-DD');
        dailySumMap[day] = (dailySumMap[day] || 0) + i.caffeine;

        if (!brandMap[i.brand_name]) {
          brandMap[i.brand_name] = {
            brand: i.brand_name,
            cups: 0,
            caffeine: 0,
          };
        }
        brandMap[i.brand_name].cups++;
        brandMap[i.brand_name].caffeine += i.caffeine;
      });

      let excessiveCount = 0;
      let moderateCount = 0;
      Object.values(dailySumMap).forEach((dayCaffeine) => {
        if (dayCaffeine >= 400) excessiveCount++;
        else if (dayCaffeine > 0) moderateCount++;
      });

      const ranking = Object.values(brandMap)
        .sort((a, b) => b.cups - a.cups || b.caffeine - a.caffeine)
        .slice(0, 5);

      const totalCups = currentIntakes.length;
      const daysInPeriod = unit === 'weekly' ? 7 : anchor.daysInMonth();
      const dailyAverage = Number((totalCups / daysInPeriod).toFixed(1));

      return {
        metrics: {
          dailyAverage,
          sum: totalCups,
          totalDays: Object.keys(dailySumMap).length,
        },
        chart,
        threshold: {
          excessiveCount,
          moderateCount,
        },
        ranking,
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
    const anchor = dateStr
      ? dayjs.utc(dateStr).add(9, 'hour')
      : dayjs.utc().add(9, 'hour');

    const dayKey = anchor.format('YYYY-MM-DD');
    const cacheKey = `caffeine:stats:chart:${userId}:${dayKey}`;

    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const weekRanges = this.getRollingWeekRanges(anchor);
      const monthRanges = this.getRollingMonthRanges(anchor);

      const globalStart = monthRanges[0].start;
      const globalEnd = anchor.endOf('day');

      const intakes = await this.caffeineRepository.findIntakesInRange(
        userId,
        this.formatDateForDb(globalStart),
        this.formatDateForDb(globalEnd),
      );

      return {
        weeks: this.aggregatePeriodicStats(
          weekRanges,
          intakes,
          'MM.DD - MM.DD',
        ),
        months: this.aggregatePeriodicStats(monthRanges, intakes, 'YYYY.MM'),
      };
    });
  }

  private getRollingWeekRanges(anchor: dayjs.Dayjs) {
    const ranges: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
    const thisWeekStart = anchor.startOf('isoWeek');
    const thisWeekEnd = anchor.endOf('isoWeek');

    for (let i = 5; i >= 1; i--) {
      const weekStart = thisWeekStart.subtract(i, 'week');
      ranges.push({
        start: weekStart,
        end: weekStart.endOf('isoWeek'),
      });
    }
    ranges.push({ start: thisWeekStart, end: thisWeekEnd });
    return ranges;
  }

  private getRollingMonthRanges(anchor: dayjs.Dayjs) {
    const ranges: { start: dayjs.Dayjs; end: dayjs.Dayjs }[] = [];
    const thisMonthStart = anchor.startOf('month');

    for (let i = 5; i >= 0; i--) {
      const monthStart = thisMonthStart.subtract(i, 'month');
      ranges.push({
        start: monthStart,
        end: monthStart.endOf('month'),
      });
    }
    return ranges;
  }

  private aggregatePeriodicStats(
    ranges: { start: dayjs.Dayjs; end: dayjs.Dayjs }[],
    intakes: CaffeineIntakeRangeRow[],
    format: string,
  ): PeriodicStatsItemDto[] {
    return ranges.map((range) => {
      const periodIntakes = intakes.filter((intake) => {
        const d = dayjs(intake.created_at);
        return (
          (d.isAfter(range.start) || d.isSame(range.start)) &&
          (d.isBefore(range.end) || d.isSame(range.end))
        );
      });

      let label = '';
      if (format === 'MM.DD - MM.DD') {
        label = `${range.start.format('MM.DD')} - ${range.end.format('MM.DD')}`;
      } else {
        label = range.start.format(format);
      }

      return {
        label,
        cups: periodIntakes.length,
        caffeineMg: periodIntakes.reduce((sum, i) => sum + i.caffeine, 0),
      };
    });
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
