import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ required: false })
  profileUrl?: string;

  @ApiProperty({ required: false })
  aboutMe?: string;

  @ApiProperty({ required: false })
  brand?: string;

  @ApiProperty({ description: 'Total caffeine from user_stats table' })
  sum: number;

  @ApiProperty({ description: '0: Mutual, 1: Public' })
  visibility: number;
}
