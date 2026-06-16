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

export interface TodayConsumptionRow {
  caffeine_sum: string | number | null;
  cup_count: number;
  items: unknown;
}

export interface CaffeineIntakeRangeRow {
  id: number;
  caffeine: number;
  created_at: Date;
}
