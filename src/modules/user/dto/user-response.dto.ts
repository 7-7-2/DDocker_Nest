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

  static fromRow(row: any, brandName?: string): UserResponseDto {
    return {
      userId: row.public_id || row.user_id || row.id,
      nickname: row.nickname || '',
      profileUrl: row.profile_url || undefined,
      aboutMe: row.bio || row.about_me || undefined,
      brand: brandName || row.brand || undefined,
      sum: Number(row.sum || row.caffeine_sum || 0),
      visibility: row.visibility ?? 1,
    };
  }
}
