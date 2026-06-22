import { ApiProperty } from '@nestjs/swagger';

export class BrandRankingDto {
  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Starbucks' })
  brandName: string;

  @ApiProperty({ example: 120 })
  intakeCount: number;

  static fromRow(row: any, brandName: string): BrandRankingDto {
    return {
      brandId: Number(row.brandId || row.brand_id),
      brandName,
      intakeCount: Number(row.intakeCount || row.score),
    };
  }
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

  static fromRow(row: any): FeedPostDto {
    return {
      postId: row.postId || row.public_id,
      photo: row.photo,
      productName: row.productName || row.product_name,
      brandId: row.brandId || row.brand_id,
      brandName: row.brandName || row.brand_name,
      caffeine: row.caffeine,
      shot: row.shot,
      likeCount: Number(row.likeCount || row.like_count || 0),
      commentCount: Number(row.commentCount || row.comment_count || 0),
      description: row.description,
      createdAt: row.createdAt || row.created_at,
      profileUrl: row.profileUrl || row.profile_url,
      nickname: row.nickname,
      userId: row.userId || row.user_id,
    };
  }
}

export class BrandPopularMenuDto {
  @ApiProperty({ example: 1 })
  brandId: number;

  @ApiProperty({ example: 'Americano' })
  productName: string;

  @ApiProperty({ example: 42 })
  orderCount: number;

  static fromRow(row: any): BrandPopularMenuDto {
    return {
      brandId: Number(row.brandId || row.brand_id),
      productName: row.productName || row.product_name,
      orderCount: Number(row.orderCount || row.order_count),
    };
  }
}
