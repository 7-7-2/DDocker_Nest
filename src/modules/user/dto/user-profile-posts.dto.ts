import { ApiProperty } from '@nestjs/swagger';
import { PostResponseDto } from '../../post/dto/post-response.dto';

export class UserPostGridItemDto {
  @ApiProperty({ example: 'https://r2.dev/photo.png' })
  photo: string;

  @ApiProperty({ example: 'post_public_id' })
  postId: string;

  @ApiProperty({ example: 1, description: '0:Private, 1:Public' })
  visibility: number;
}

export class UserProfilePostsResponseDto {
  @ApiProperty({ type: [UserPostGridItemDto], required: false })
  posts?: UserPostGridItemDto[];

  @ApiProperty({ type: [PostResponseDto], required: false })
  listPosts?: PostResponseDto[];

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z', required: false, nullable: true })
  nextCursor?: string | null;
}
