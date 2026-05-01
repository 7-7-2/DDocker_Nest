import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRow } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { RedisService } from '../../providers/redis/redis.service';
import { OAuthUser } from '../../auth/interfaces/oauth-user.interface';
import { UserRepository, UserWithStatsRow } from './user.repository';
import { BrandService } from '../brand/brand.service';
import { AuthService } from '../../auth/auth.service';

type PatchUser = Omit<UpdateUserDto, 'brand'> & { fav_brand_id: number };

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly brandService: BrandService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  async setUserInit(
    dto: CreateUserDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const oauthUser = await this.redisService.get<OAuthUser>(
      `auth_handover:${dto.socialToken}`,
    );

    if (!oauthUser) {
      throw new UnauthorizedException('Invalid or expired social token');
    }

    const favBrandId = await this.brandService.resolveBrandId(dto.brand);
    if (!favBrandId) {
      throw new BadRequestException(`Invalid brand name: ${dto.brand}`);
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
          fav_brand_id: favBrandId,
          profile_url: dto.profileUrl,
          bio: dto.aboutMe,
          social: oauthUser.provider,
          visibility: dto.visibility ?? 1,
        },
        queryRunner,
      );

      await this.userRepository.insertInitStats(dto.userId, queryRunner);

      await queryRunner.commitTransaction();
      await this.redisService.del(`auth_handover:${dto.socialToken}`);

      const user = await this.userRepository.findByPublicId(dto.userId);
      if (!user) {
        throw new InternalServerErrorException('Failed to retrieve new user');
      }

      const { accessToken, refreshToken } = await this.authService.login(user);
      return {
        accessToken: `Bearer ${accessToken}`,
        refreshToken,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof Error && (error as any).errno === 1062) {
        throw new ConflictException('Nickname or User already exists');
      }

      throw error instanceof InternalServerErrorException
        ? error
        : new InternalServerErrorException('Failed to initialize user profile');
    } finally {
      await queryRunner.release();
    }
  }

  async getUserInfo(userId: string): Promise<UserResponseDto> {
    const cacheKey = `user:profile:${userId}`;
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const userWithStats = await this.userRepository.findUserWithStats(userId);

      if (!userWithStats) {
        throw new NotFoundException('User not found');
      }

      return await this.mapToResponseDto(userWithStats);
    });
  }

  async patchUserProfile(userId: string, dto: UpdateUserDto): Promise<void> {
    const { brand, ...rest } = dto;

    const updateData: PatchUser = { fav_brand_id: 0, ...rest };

    if (dto.brand) {
      const favBrandId = await this.brandService.resolveBrandId(
        brand as string,
      );
      if (!favBrandId) {
        throw new BadRequestException(`Invalid brand name: ${dto.brand}`);
      }
      updateData.fav_brand_id = favBrandId;
    }

    if (Object.keys(updateData).length === 0) return;

    await this.userRepository.patchUserProfile(
      userId,
      brand ? updateData : rest,
    );
    await this.redisService.del(`user:profile:${userId}`);
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.userRepository.deleteAccount(userId);
    await this.redisService.del([
      `user:profile:${userId}`,
      `user:stats:${userId}`,
    ]);
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

  async getUserFollowCounts(
    userId: string,
  ): Promise<{ follower: number; following: number }> {
    const cacheKey = `user:stats:${userId}`;
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const counts = await this.userRepository.findUserFollowCounts(userId);
      return counts || { follower: 0, following: 0 };
    });
  }

  async updateLastNotiRead(userId: string): Promise<void> {
    await this.userRepository.updateLastNotiRead(userId);
  }

  async getLastNotiRead(userId: string): Promise<Date | null> {
    return await this.userRepository.findLastNotiRead(userId);
  }

  private async mapToResponseDto(
    row: UserWithStatsRow,
  ): Promise<UserResponseDto> {
    const brandName = row.fav_brand_id
      ? await this.brandService.resolveBrandName(row.fav_brand_id)
      : '';

    return {
      userId: row.public_id,
      nickname: row.nickname || '',
      profileUrl: row.profile_url || '',
      aboutMe: row.bio || '',
      brand: brandName || '',
      sum: row.sum || 0,
      visibility: row.visibility,
    };
  }
}
