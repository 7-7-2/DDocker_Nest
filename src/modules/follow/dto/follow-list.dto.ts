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

  cursorId: number;
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
