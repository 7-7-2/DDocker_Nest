import { ApiProperty } from '@nestjs/swagger';

export class PostResponseDto {
  @ApiProperty()
  postId: string;

  @ApiProperty()
  userId?: string;

  @ApiProperty()
  nickname?: string;

  @ApiProperty({ required: false, nullable: true })
  profileUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  photo?: string | null;

  @ApiProperty({ required: false, nullable: true })
  description?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  likeCount?: number;

  @ApiProperty()
  commentCount?: number;

  @ApiProperty({ description: '0: Private, 1: Public, 2: Mutual' })
  visibility: number;

  // Joined Caffeine Intake Info
  @ApiProperty()
  brandId: number;

  @ApiProperty()
  brand?: string;

  @ApiProperty()
  caffeine: number;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  size?: string;

  @ApiProperty()
  shot?: number;

  @ApiProperty()
  intensity?: string;

  @ApiProperty()
  userSum?: number;

  @ApiProperty({ required: false })
  cursorId?: number;

  static fromRow(
    row: any,
    stats?: { likeCount: number; commentCount: number },
    brandName?: string,
  ): PostResponseDto {
    const likeCount = stats ? stats.likeCount : row.like_count;
    const commentCount = stats ? stats.commentCount : row.comment_count;

    return {
      postId: row.public_id,
      userId: row.user_id,
      nickname: row.nickname,
      profileUrl: row.profile_url || undefined,
      photo: row.photo || undefined,
      description: row.description || undefined,
      createdAt: row.created_at,
      likeCount: Number(likeCount) || 0,
      commentCount: Number(commentCount) || 0,
      visibility: row.visibility,
      brandId: row.brand_id,
      brand: brandName || undefined,
      caffeine: Number(row.caffeine),
      productName: row.product_name,
      size: row.size || undefined,
      shot: row.shot,
      intensity: row.intensity || undefined,
      userSum: Number(row.user_sum) || 0,
      cursorId: row.id,
    };
  }

  static fromRows(
    rows: any[],
    brandResolver: (id: number) => string | undefined,
  ): PostResponseDto[] {
    return rows.map((row) =>
      this.fromRow(row, undefined, brandResolver(row.brand_id)),
    );
  }
}

export class PaginatedPostResponseDto {
  @ApiProperty({ type: [PostResponseDto] })
  posts: PostResponseDto[];

  @ApiProperty({ nullable: true })
  nextCursor: string | null;
}

export class SocialCountsResponseDto {
  @ApiProperty()
  likeCount: number;

  @ApiProperty()
  commentCount: number;
}
