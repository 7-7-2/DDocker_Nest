import { ApiProperty } from '@nestjs/swagger';

export interface CaffeineMonthlySummaryRow {
  day: number;
  caffeineSum: number;
}

export interface CaffeineMonthlyDetailRow {
  day: number;
  brand_name: string;
  caffeine: number;
  product_name: string;
  intensity: string;
  shot: number;
  size: string;
}

export class CaffeineSummaryItemDto {
  @ApiProperty({ example: 19 })
  day: number;

  @ApiProperty({ example: 450 })
  caffeineSum: number;
}

export class CaffeineDetailItemDto {
  @ApiProperty()
  brandName: string;

  @ApiProperty()
  caffeine: number;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  intensity: string;

  @ApiProperty()
  shot: number;

  @ApiProperty()
  size: string;
}

export class CaffeineMonthlyViewDto {
  @ApiProperty({ type: [CaffeineSummaryItemDto] })
  summary: CaffeineSummaryItemDto[];

  @ApiProperty({
    description: 'Map of day numbers to arrays of drink details',
    example: { '19': [{ brandName: 'Starbucks', caffeine: 225 }] },
  })
  details: Record<string, CaffeineDetailItemDto[]>;
}
