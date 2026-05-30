import { ApiProperty } from '@nestjs/swagger';

export class ComparisonItemDto {
  @ApiProperty({ example: 'Paul Bassett' })
  brandName: string;

  @ApiProperty({ example: 'Americano' })
  productName: string;

  @ApiProperty({ example: 200 })
  caffeine: number;

  @ApiProperty({ example: 50, description: 'Caffeine difference relative to source' })
  diff: number;
}

export class ComparisonResponseDto {
  @ApiProperty({ example: 'americano' })
  sourceType: string;

  @ApiProperty({ example: 150 })
  baseCaffeine: number;

  @ApiProperty({ type: [ComparisonItemDto] })
  comparisons: ComparisonItemDto[];
}
