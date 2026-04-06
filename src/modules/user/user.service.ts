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
  ): Promise<string> {
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

      const loginResult = await this.authService.login(user);
      return `Bearer ${loginResult.accessToken}`;
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
    const userWithStats = await this.userRepository.findUserWithStats(userId);

    if (!userWithStats) {
      throw new NotFoundException('User not found');
    }

    return await this.mapToResponseDto(userWithStats);
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

  async getUserFollowCounts(
    userId: string,
  ): Promise<{ follower: number; following: number }> {
    const counts = await this.userRepository.findUserFollowCounts(userId);
    return counts || { follower: 0, following: 0 };
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
