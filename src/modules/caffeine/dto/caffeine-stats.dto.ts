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

export class WeeklyTrendDto {
  @ApiProperty({ example: '03.09~03.15', description: 'Calendar week range' })
  range: string;

  @ApiProperty({ example: 12, description: 'Total cups consumed in that week' })
  cups: number;
}

export class WeeklyStatsResponseDto {
  @ApiProperty({ type: [WeeklyTrendDto] })
  trend: WeeklyTrendDto[];
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
