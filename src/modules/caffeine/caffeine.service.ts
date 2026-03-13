import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateCaffeineDto } from './dto/create-caffeine.dto';
import { CaffeineRepository } from './caffeine.repository';
import {
  CaffeineMonthlyViewDto,
  CaffeineDetailItemDto,
  CaffeineSummaryItemDto,
} from './dto/caffeine-calendar.dto';

@Injectable()
export class CaffeineService {
  private readonly logger = new Logger(CaffeineService.name);

  constructor(private readonly caffeineRepository: CaffeineRepository) {}

  async logIntake(userId: string, dto: CreateCaffeineDto): Promise<number> {
    const queryRunner = await this.caffeineRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const intakeId = await this.caffeineRepository.insertIntake(
        {
          user_id: userId,
          brand_id: dto.brandId,
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

      await queryRunner.commitTransaction();
      this.logger.log(`Intake ${intakeId} logged for user ${userId}`);
      return intakeId;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to log intake for user ${userId}`, error);
      throw new InternalServerErrorException(
        'Failed to record caffeine intake',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getMonthlyView(
    userId: string,
    dateStr: string,
  ): Promise<CaffeineMonthlyViewDto> {
    const { start, end } = this.getMonthRange(dateStr);

    const dailyLogs = await this.caffeineRepository.findMonthlyDetails(
      userId,
      start,
      end,
    );

    const details: Record<string, CaffeineDetailItemDto[]> = {};
    const sumsMap: Record<number, number> = {};

    dailyLogs.forEach((dailyLog) => {
      const day = dailyLog.day;
      const dayKey = day.toString();

      if (!details[dayKey]) details[dayKey] = [];
      details[dayKey].push({
        brandName: dailyLog.brand_name,
        caffeine: dailyLog.caffeine,
        productName: dailyLog.product_name,
        intensity: dailyLog.intensity,
        shot: dailyLog.shot,
        size: dailyLog.size,
      });

      sumsMap[day] = (sumsMap[day] || 0) + dailyLog.caffeine;
    });

    const summary: CaffeineSummaryItemDto[] = Object.keys(sumsMap).map(
      (day) => ({
        day: parseInt(day, 10),
        caffeineSum: sumsMap[parseInt(day, 10)],
      }),
    );

    return {
      summary,
      details,
    };
  }

  private getMonthRange(dateStr: string): { start: string; end: string } {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new InternalServerErrorException('Invalid date format');
    }

    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1, 0, 0, 0);
    const lastDay = new Date(year, month + 1, 0, 23, 59, 59);

    return {
      start: firstDay.toISOString().slice(0, 19).replace('T', ' '),
      end: lastDay.toISOString().slice(0, 19).replace('T', ' '),
    };
  }
}
