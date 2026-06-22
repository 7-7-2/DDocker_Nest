import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRow } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { RedisService } from '../../providers/redis/redis.service';
import { OAuthUser } from '../../auth/interfaces/oauth-user.interface';
import { UserRepository } from './user.repository';
import { BrandService } from '../brand/brand.service';
import { AuthService } from '../../auth/auth.service';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import { TransactionManager } from '../../common/database/transaction.manager';

type PatchUser = Omit<UpdateUserDto, 'brand'> & { fav_brand_id: number };
/**
 * Wrapper type used to circumvent ESM modules circular dependency issue
 * caused by reflection metadata saving the type of the property.
 */
export type WrapperType<T> = T; // WrapperType === Relation

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly brandService: BrandService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: WrapperType<AuthService>,
    private readonly txManager: TransactionManager,
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

    await this.txManager.run(
      async (queryRunner) => {
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
      },
      {
        logger: this.logger,
        context: 'setUserInit',
        message: 'Failed to initialize user profile',
      },
    );

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
  }

  async getUserInfo(userId: string): Promise<UserResponseDto> {
    const cacheKey = REDIS_KEYS.USER.PROFILE(userId);
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const userWithStats = await this.userRepository.findUserWithStats(userId);

      if (!userWithStats) {
        throw new NotFoundException('User not found');
      }

      const brandName = userWithStats.fav_brand_id
        ? await this.brandService.resolveBrandName(userWithStats.fav_brand_id)
        : undefined;

      return UserResponseDto.fromRow(userWithStats, brandName || undefined);
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
    await this.redisService.del(REDIS_KEYS.USER.PROFILE(userId));
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.userRepository.deleteAccount(userId);
    await this.redisService.del([
      REDIS_KEYS.USER.PROFILE(userId),
      REDIS_KEYS.USER.STATS(userId),
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
    const cacheKey = REDIS_KEYS.USER.STATS(userId);
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
}
