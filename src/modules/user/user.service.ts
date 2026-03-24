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
import { UserRepository, UserWithStatsRow } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
  ) {}

  async setUserInit(dto: CreateUserDto): Promise<void> {
    const oauthUser = await this.redisService.get<OAuthUser>(
      `auth_handover:${dto.socialToken}`,
    );

    if (!oauthUser) {
      throw new UnauthorizedException('Invalid or expired social token');
    }

    const queryRunner = await this.userRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.userRepository.insertUser(
        {
          public_id: dto.userId,
          useremail: oauthUser.email,
          nickname: dto.nickname,
          fav_brand_id: dto.favBrandId,
          profile_url: dto.profileUrl,
          bio: dto.aboutMe,
          social: oauthUser.provider,
          visibility: dto.visibility,
        },
        queryRunner,
      );

      await this.userRepository.insertInitStats(dto.userId, queryRunner);

      await queryRunner.commitTransaction();
      await this.redisService.del(`auth_handover:${dto.socialToken}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof Error && (error as any).errno === 1062) {
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
    const userWithStats = await this.userRepository.findUserWithStats(userId);

    if (!userWithStats) {
      throw new NotFoundException('User not found');
    }

    return this.mapToResponseDto(userWithStats);
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

  async getAuthUserByPublicId(
    publicId: string,
  ): Promise<Pick<UserRow, 'nickname' | 'public_id'> | null> {
    return await this.userRepository.findAuthUserByPublicId(publicId);
  }

  async findByPublicId(publicId: string): Promise<UserRow | null> {
    return await this.userRepository.findByPublicId(publicId);
  }

  async findByEmailAndProvider(
    email: string,
    social: string,
  ): Promise<UserRow | null> {
    return await this.userRepository.findByEmailAndProvider(email, social);
  }

  private mapToResponseDto(row: UserWithStatsRow): UserResponseDto {
    return {
      userId: row.public_id,
      nickname: row.nickname || '',
      profileUrl: row.profile_url || '',
      bio: row.bio || '',
      favBrandId: row.fav_brand_id || 0,
      sum: row.sum || 0,
      visibility: row.visibility,
    };
  }
}
