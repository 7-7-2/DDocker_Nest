import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository, UserWithStatsRow } from './user.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getUserInfo(userId: string): Promise<UserResponseDto> {
    const userWithStats = await this.userRepository.findUserWithStats(userId);

    if (!userWithStats) {
      throw new NotFoundException('User not found');
    }

    return this.mapUserToResDto(userWithStats);
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    return await this.userRepository.patchUserProfile(userId, updateUserDto);
  }

  async checkNickname(nickname: string): Promise<boolean> {
    return await this.userRepository.checkNickname(nickname);
  }

  async remove(userId: string) {
    return await this.userRepository.deleteAccount(userId);
  }

  private mapUserToResDto(row: UserWithStatsRow): UserResponseDto {
    return {
      userId: row.public_id,
      nickname: row.nickname || '',
      profileUrl: row.profile_url || '',
      bio: row.bio || '',
      favBrandId: row.fav_brand_id || 0,
      accountPrivacy: row.account_privacy,
      sum: row.sum || 0,
    };
  }
}
