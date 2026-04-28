import { ApiProperty } from '@nestjs/swagger';

export class BrandRankingDto {
  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Starbucks' })
  brandName: string;

  @ApiProperty({ example: 120 })
  intakeCount: number;
}

export class FeedPostDto {
  @ApiProperty({ example: 'post_public_id' })
  postId: string;

  @ApiProperty({ example: 'https://r2.dev/photo.png' })
  photo: string;

  @ApiProperty({ example: 'Americano', required: false })
  productName?: string;

  @ApiProperty({ example: 1, required: false })
  brandId?: number;

  @ApiProperty({ example: 'Starbucks', required: false })
  brandName?: string;

  @ApiProperty({ example: 150, required: false })
  caffeine?: number;

  @ApiProperty({ example: 2, required: false })
  shot?: number;

  @ApiProperty({ example: 10 })
  likeCount: number;

  @ApiProperty({ example: 5, required: false })
  commentCount?: number;

  @ApiProperty({ example: 'Delicious!', required: false })
  description?: string;

  @ApiProperty({ example: '2024-01-01T00:00:00Z', required: false })
  createdAt?: Date;

  @ApiProperty({ example: 'https://r2.dev/profile.png', required: false })
  profileUrl?: string;

  @ApiProperty({ example: 'CoffeeLover', required: false })
  nickname?: string;

  @ApiProperty({ example: 'user_public_id', required: false })
  userId?: string;
}

export class BrandPopularMenuDto {
  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Americano' })
  productName: string;

  @ApiProperty({ example: 42 })
  orderCount: number;
}
