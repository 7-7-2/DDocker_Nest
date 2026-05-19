import { ApiProperty } from '@nestjs/swagger';

export class TodayCaffeineItemDto {
  @ApiProperty()
  brandName: string;

  @ApiProperty()
  caffeine: number;
}

export class TodayCaffeineResponseDto {
  @ApiProperty({ description: 'Total caffeine today in mg' })
  todayCaffeine: number;

  @ApiProperty({ description: 'Total cups today' })
  todayCups: number;

  @ApiProperty({ type: [TodayCaffeineItemDto] })
  items: TodayCaffeineItemDto[];
}

export class MonthlyWeekTrendDto {
  @ApiProperty({ example: 1, description: 'Week number of the month (1-5)' })
  weekNum: number;

  @ApiProperty({ example: 4, description: 'Total cups in this week' })
  cups: number;

  @ApiProperty({
    example: 480,
    description: 'Total caffeine in mg in this week',
  })
  caffeineMg: number;
}

export class ComparisonDetailDto {
  @ApiProperty({ example: 30 })
  currentMonth: number;

  @ApiProperty({ example: 17 })
  previousMonth: number;

  @ApiProperty({ example: 13 })
  diff: number;

  @ApiProperty({ enum: ['higher', 'lower', 'equal'], example: 'higher' })
  trend: 'higher' | 'lower' | 'equal';
}

export class MonthlyStatsResponseDto {
  @ApiProperty({ type: [MonthlyWeekTrendDto] })
  weeks: MonthlyWeekTrendDto[];

  @ApiProperty()
  comparison: {
    cups: ComparisonDetailDto;
    caffeine: ComparisonDetailDto;
  };
}

export interface TodayConsumptionRow {
  caffeine_sum: string | number | null;
  cup_count: number;
  items: unknown;
}

export interface WeeklyCupsRow {
  week_key: number;
  cups: number;
  week_start: string | Date;
  week_end: string | Date;
}

export interface CaffeineIntakeRangeRow {
  id: number;
  caffeine: number;
  created_at: Date;
}
