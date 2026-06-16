import { ApiProperty } from '@nestjs/swagger';

export class IntakeTrendMetricsDto {
  @ApiProperty({ example: 1.5 })
  dailyAverage: number;

  @ApiProperty({ example: 10, description: 'Total cups in current period' })
  sum: number;

  @ApiProperty({ example: 5, description: 'Total days with consumption in current period' })
  totalDays: number;
}

export class IntakeTrendChartItemDto {
  @ApiProperty({ example: '04.27 - 05.03' })
  label: string;

  @ApiProperty({ example: 3 })
  cups: number;

  @ApiProperty({ example: 792 })
  caffeineMg: number;
}

export class IntakeTrendThresholdDto {
  @ApiProperty({ example: 1, description: 'Days >= 400mg' })
  excessiveCount: number;

  @ApiProperty({ example: 2, description: '0 < days < 400mg' })
  moderateCount: number;
}

export class IntakeTrendRankingItemDto {
  @ApiProperty({ example: 'Starbucks' })
  brand: string;

  @ApiProperty({ example: 12 })
  cups: number;

  @ApiProperty({ example: 1234 })
  caffeine: number;
}

export class IntakeTrendResponseDto {
  @ApiProperty({ type: IntakeTrendMetricsDto })
  metrics: IntakeTrendMetricsDto;

  @ApiProperty({ type: [IntakeTrendChartItemDto] })
  chart: IntakeTrendChartItemDto[];

  @ApiProperty({ type: IntakeTrendThresholdDto })
  threshold: IntakeTrendThresholdDto;

  @ApiProperty({ type: [IntakeTrendRankingItemDto] })
  ranking: IntakeTrendRankingItemDto[];
}
