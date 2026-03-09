import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRow } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { RedisService } from '../../providers/redis/redis.service';
import { OAuthUser } from '../../auth/interfaces/oauth-user.interface';
import { UserRepository } from './user.repository';

class MysqlError extends Error {
  errno: number;
}

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {}

  async setUserInit(dto: CreateUserDto): Promise<void> {
    // 1. Verify socialToken in Redis
    const oauthUser = await this.redisService.get<OAuthUser>(
      `auth_handover:${dto.socialToken}`,
    );

    if (!oauthUser) {
      throw new UnauthorizedException('Invalid or expired social token');
    }

    const queryRunner = await this.userRepository.getQueryRunner();
    await queryRunner.startTransaction();

    try {
      // 2. Insert into user table (using verified email/social from Redis)
      await this.userRepository.insertUser(
        {
          public_id: dto.userId,
          useremail: oauthUser.email,
          nickname: dto.nickname,
          fav_brand_id: dto.favBrandId,
          profile_url: dto.profileUrl,
          bio: dto.aboutMe,
          social: oauthUser.provider,
        },
        queryRunner,
      );

      // 3. Initialize user_stats
      await this.userRepository.insertInitStats(dto.userId, queryRunner);

      await queryRunner.commitTransaction();

      // 4. Cleanup Redis after successful registration
      await this.redisService.del(`auth_handover:${dto.socialToken}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof MysqlError && error.errno === 1062) {
        throw new ConflictException('Nickname or User already exists');
      }

      throw new InternalServerErrorException(
        'Failed to initialize user profile',
      );
    } finally {
      await queryRunner.release();
    }
  }

  async getUserInfo(userId: string): Promise<UserResponseDto> {
    const userInfo = await this.userRepository.getUserInfo(userId);
    if (!userInfo) {
      throw new NotFoundException('User not found');
    }
    return userInfo;
  }

  async patchUserProfile(userId: string, dto: UpdateUserDto): Promise<void> {
    await this.userRepository.patchUserProfile(userId, dto);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.userRepository.deleteAccount(userId);
  }

  async checkUserNickname(nickname: string): Promise<boolean> {
    return await this.userRepository.checkNickname(nickname);
  }

  // Used for Auth Guard
  async findByPublicId(publicId: string): Promise<UserRow | null> {
    return await this.userRepository.findByPublicId(publicId);
  }

  async findByEmailAndProvider(
    email: string,
    social: string,
  ): Promise<UserRow | null> {
    return await this.userRepository.findByEmailAndProvider(email, social);
  }
}
