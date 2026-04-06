import { ApiProperty } from '@nestjs/swagger';

export class BrandRankingDto {
  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Starbucks' })
  brandName: string;

  @ApiProperty({ example: 120 })
  intakeCount: number;
}

export class PopularPostDto {
  @ApiProperty({ example: 'post_public_id' })
  postId: string;

  @ApiProperty({ example: 'https://r2.dev/photo.png' })
  photo: string;

  @ApiProperty({ example: 'Americano' })
  productName: string;

  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Starbucks' })
  brandName: string;

  @ApiProperty({ example: 150 })
  caffeine: number;

  @ApiProperty({ example: 2 })
  shot: number;

  @ApiProperty({ example: 10 })
  likeCount: number;
}

export class BrandPopularMenuDto {
  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Americano' })
  productName: string;

  @ApiProperty({ example: 42 })
  orderCount: number;
}
