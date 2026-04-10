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
