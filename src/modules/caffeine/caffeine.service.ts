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

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(
    private readonly caffeineRepository: CaffeineRepository,
    private readonly brandService: BrandService,
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

  async getTodayConsumption(userId: string): Promise<TodayCaffeineResponseDto> {
    const now = new Date();
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
    );
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );

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
      todayCups: row.cup_count,
      items: this.parseItems(row.items),
    };
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
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;

    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - diffToMonday);
    currentMonday.setHours(0, 0, 0, 0);

    const sixWeeksAgoMonday = new Date(currentMonday);
    sixWeeksAgoMonday.setDate(currentMonday.getDate() - 35);

    const rows = await this.caffeineRepository.findWeeklyCupStats(
      userId,
      this.formatDateForDb(sixWeeksAgoMonday),
    );

    const trend: WeeklyTrendDto[] = rows.map((row) => {
      const start = new Date(row.week_start);
      const end = new Date(row.week_end);
      const label = `${this.formatDateShort(start)}~${this.formatDateShort(end)}`;

      return {
        range: label,
        cups: row.cups,
      };
    });

    return { trend };
  }

  async getMonthlyView(
    userId: string,
    dateStr: string,
  ): Promise<CaffeineMonthlyViewDto> {
    const { start, end } = this.getMonthRange(dateStr);
    const rows = await this.caffeineRepository.findMonthlyDetails(
      userId,
      start,
      end,
    );

    const details: Record<string, CaffeineDetailItemDto[]> = {};
    const sumsMap: Record<number, number> = {};

    rows.forEach((row) => {
      const day = row.day;
      const dayKey = day.toString();

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

      sumsMap[day] = (sumsMap[day] || 0) + row.caffeine;
    });

    const summary: CaffeineSummaryItemDto[] = Object.keys(sumsMap)
      .map((day) => parseInt(day, 10))
      .sort((a, b) => a - b)
      .map((day) => ({
        day,
        caffeineSum: sumsMap[day],
      }));

    return { summary, details };
  }

  private getMonthRange(dateStr: string): { start: string; end: string } {
    const date = new Date(dateStr);
    if (isNaN(date.getTime()))
      throw new InternalServerErrorException('Invalid date');
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
    const lastDay = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    return {
      start: this.formatDateForDb(firstDay),
      end: this.formatDateForDb(lastDay),
    };
  }

  private formatDateForDb(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  private formatDateShort(date: Date): string {
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${m}.${d}`;
  }
}
