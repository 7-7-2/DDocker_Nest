import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ required: false })
  profileUrl?: string;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty({ required: false })
  favBrandId?: number;

  @ApiProperty({ description: 'Total caffeine from user_stats table' })
  sum: number;
}
