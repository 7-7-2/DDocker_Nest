import { ApiProperty } from '@nestjs/swagger';

export class FollowUserItemDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ required: false })
  profileUrl?: string;

  @ApiProperty({ description: 'Total caffeine intake from stats table' })
  caffeineSum: number;

  @ApiProperty({ description: '0: Mutual, 1: Public' })
  visibility: number;

  cursorId: number;

  static fromRow(row: any): FollowUserItemDto {
    return {
      userId: row.public_id,
      nickname: row.nickname,
      profileUrl: row.profile_url || undefined,
      caffeineSum: row.caffeine_sum,
      visibility: row.visibility,
      cursorId: row.cursor_id,
    };
  }
}

export class PaginatedFollowResponseDto {
  @ApiProperty({ type: [FollowUserItemDto] })
  users: FollowUserItemDto[];

  @ApiProperty({
    description:
      'The ID to pass as "cursor" query param for the next page. Null if no more pages.',
    nullable: true,
  })
  nextCursor: number | null;
}
