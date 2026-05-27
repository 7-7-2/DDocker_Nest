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

export class PeriodicStatsItemDto {
  @ApiProperty({
    example: '05.27',
    description: 'Period label (MM.DD, MM.DD - MM.DD, or YYYY.MM)',
  })
  label: string;

  @ApiProperty({ example: 4, description: 'Total cups in this period' })
  cups: number;

  @ApiProperty({
    example: 480,
    description: 'Total caffeine in mg in this period',
  })
  caffeineMg: number;
}

export class MonthlyStatsResponseDto {
  @ApiProperty({ type: [PeriodicStatsItemDto] })
  days: PeriodicStatsItemDto[];

  @ApiProperty({ type: [PeriodicStatsItemDto] })
  weeks: PeriodicStatsItemDto[];

  @ApiProperty({ type: [PeriodicStatsItemDto] })
  months: PeriodicStatsItemDto[];
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
