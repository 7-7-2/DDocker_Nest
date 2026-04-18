import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
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
  WeeklyStatsResponseDto,
  WeeklyTrendDto,
} from './dto/caffeine-stats.dto';

import { RedisService } from '../../providers/redis/redis.service';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(
    private readonly caffeineRepository: CaffeineRepository,
    private readonly brandService: BrandService,
    private readonly redisService: RedisService,
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

  private async invalidateCaffeineCaches(userId: string) {
    const fakeKSTNow = dayjs.utc().add(9, 'hour');
    const monthKey = fakeKSTNow.format('YYYY-MM');

    const keys = [
      `caffeine:today:${userId}`,
      `caffeine:monthly:${userId}:${monthKey}`,
      `user:profile:${userId}`,
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

  async getWeeklyTrend(userId: string): Promise<WeeklyStatsResponseDto> {
    const cacheKey = `caffeine:weekly:${userId}`;
    return await this.redisService.getOrSet(cacheKey, 10800, async () => {
      const fakeKSTNow = dayjs.utc().add(9, 'hour');

      const currentMonday = fakeKSTNow.startOf('week').add(1, 'day');
      const sixWeeksAgoMonday = currentMonday
        .subtract(35, 'day')
        .startOf('day');

      const rows = await this.caffeineRepository.findWeeklyCupStats(
        userId,
        this.formatDateForDb(sixWeeksAgoMonday),
      );

      const trend: WeeklyTrendDto[] = rows.map((row) => {
        const start = dayjs(row.week_start);
        const end = dayjs(row.week_end);

        return {
          range: `${this.formatDateShort(start)}~${this.formatDateShort(end)}`,
          cups: row.cups,
        };
      });

      return { trend };
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
          menu: row.product_name,
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

  private formatDateShort(date: Date | dayjs.Dayjs): string {
    return dayjs(date).format('MM.DD');
  }
}
