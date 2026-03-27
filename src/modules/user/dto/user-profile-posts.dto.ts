import { ApiProperty } from '@nestjs/swagger';

export class UserPostGridItemDto {
  @ApiProperty({ example: 'https://r2.dev/photo.png' })
  photo: string;

  @ApiProperty({ example: 'post_public_id' })
  postId: string;
}

export class UserProfilePostsResponseDto {
  @ApiProperty({ example: 42 })
  allCount: number;

  @ApiProperty({ type: [UserPostGridItemDto] })
  posts: UserPostGridItemDto[];
}
