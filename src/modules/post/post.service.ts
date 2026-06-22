import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PostRepository } from './post.repository';
import {
  PostResponseDto,
  PaginatedPostResponseDto,
} from './dto/post-response.dto';
import { RedisService } from '../../providers/redis/redis.service';
import { CaffeineService } from '../caffeine/caffeine.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CaffeineRepository } from '../caffeine/caffeine.repository';
import { UserProfilePostsResponseDto } from '../user/dto/user-profile-posts.dto';
import { BrandService } from '../brand/brand.service';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import { DateUtil } from '../../common/utils/date.util';
import { TransactionManager } from '../../common/database/transaction.manager';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly postRepository: PostRepository,
    private readonly redisService: RedisService,
    private readonly caffeineService: CaffeineService,
    private readonly caffeineRepository: CaffeineRepository,
    private readonly brandService: BrandService,
    private readonly txManager: TransactionManager,
  ) {}

  async registerPost(userId: string, dto: CreatePostDto): Promise<void> {
    const brandId = await this.validateBrand(dto.brand);

    await this.txManager.run(
      async (queryRunner) => {
        const intakeId = await this.caffeineService.logIntake(
          userId,
          {
            brandId,
            caffeine: dto.caffeine,
            productName: dto.productName,
            size: dto.size,
            shot: dto.shot,
            intensity: dto.intensity,
          },
          queryRunner,
        );

        await this.postRepository.insertPost(
          {
            user_id: userId,
            caffeine_intake_id: intakeId,
            photo: dto.photo,
            public_id: dto.postId,
            description: dto.description,
            visibility: dto.visibility,
          },
          queryRunner,
        );

        await this.postRepository.insertPostStats(dto.postId, queryRunner);
        await this.postRepository.updateUserStatsPostCount(
          userId,
          1,
          queryRunner,
        );
      },
      {
        logger: this.logger,
        context: 'registerPost',
        message: 'Failed to register post',
      },
    );

    await this.redisService.del([
      REDIS_KEYS.USER.STATS(userId),
      REDIS_KEYS.USER.POSTS(userId, 'grid'),
      REDIS_KEYS.USER.POSTS(userId, 'list'),
    ]);

    this.logger.log(`Post ${dto.postId} registered for user ${userId}`);
  }

  private async validateBrand(brandName: string): Promise<number> {
    const brandId = await this.brandService.resolveBrandId(brandName);
    if (!brandId) {
      throw new BadRequestException(`Invalid brand: ${brandName}`);
    }
    return brandId;
  }

  async getPostByIntakeId(intakeId: number): Promise<string | null> {
    const post = await this.postRepository.findPostByIntakeId(intakeId);
    return post ? post.public_id : null;
  }

  async deletePost(userId: string, postId: string): Promise<void> {
    const post = await this.postRepository.findPostDetail(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.user_id !== userId) {
      this.logger.warn(
        `Unauthorized delete attempt: user ${userId} post ${postId}`,
      );
      throw new InternalServerErrorException('Unauthorized post deletion');
    }

    await this.txManager.run(
      async (queryRunner) => {
        await this.postRepository.softDeletePost(postId, queryRunner);
        await this.caffeineRepository.softDeleteIntake(
          post.caffeine_intake_id,
          queryRunner,
        );
        await this.caffeineRepository.updateUserStatsSum(
          userId,
          -post.caffeine,
          queryRunner,
        );
        await this.postRepository.updateUserStatsPostCount(
          userId,
          -1,
          queryRunner,
        );
      },
      {
        logger: this.logger,
        context: 'deletePost',
        message: 'Failed to delete post',
      },
    );

    // Clear common post caches
    await this.redisService.del([
      REDIS_KEYS.USER.STATS(userId),
      REDIS_KEYS.POST.DETAIL(postId),
      REDIS_KEYS.POST.STATS(postId),
      REDIS_KEYS.USER.POSTS(userId, 'grid'),
      REDIS_KEYS.USER.POSTS(userId, 'list'),
    ]);

    // NEW: Clear caffeine caches to update main page / stats immediately
    const intakeDate = DateUtil.toKst(post.created_at);
    const monthKey = DateUtil.getMonthKey(intakeDate);
    await this.redisService.del([
      REDIS_KEYS.CAFFEINE.TODAY(userId),
      REDIS_KEYS.CAFFEINE.MONTHLY(userId, monthKey),
      REDIS_KEYS.USER.PROFILE(userId),
    ]);

    await this.caffeineService.updateBrandRanking(
      post.brand_id,
      -1,
      post.created_at,
    );

    this.logger.log(`Post ${postId} deleted for user ${userId}`);
  }

  async patchPost(
    userId: string,
    postId: string,
    dto: UpdatePostDto,
  ): Promise<void> {
    const post = await this.postRepository.findPostDetail(postId);
    if (!post) throw new NotFoundException('Post not found');

    if (post.user_id !== userId) {
      throw new InternalServerErrorException('Unauthorized post update');
    }

    await this.postRepository.patchPost(postId, dto);
    await this.redisService.del([
      REDIS_KEYS.USER.STATS(userId),
      REDIS_KEYS.POST.DETAIL(postId),
      REDIS_KEYS.USER.POSTS(userId, 'grid'),
      REDIS_KEYS.USER.POSTS(userId, 'list'),
    ]);
  }

  async getPostDetail(postId: string): Promise<PostResponseDto> {
    const cacheKey = REDIS_KEYS.POST.DETAIL(postId);
    return await this.redisService.getOrSet(cacheKey, 300, async () => {
      const stats = await this.getStatsWithFallback(postId);
      const row = await this.postRepository.findPostDetail(postId);
      if (!row) throw new NotFoundException('Post not found');

      const brandName =
        (await this.brandService.resolveBrandName(row.brand_id)) || undefined;
      return PostResponseDto.fromRow(row, stats, brandName);
    });
  }

  async getFollowingPosts(
    userId: string,
    cursor?: string | null,
  ): Promise<PaginatedPostResponseDto> {
    const sanitizedCursor =
      cursor === 'null' || cursor === 'undefined' ? null : cursor;

    const isPage1 = sanitizedCursor === null;
    const cacheKey = REDIS_KEYS.POST.FEED(userId);

    if (isPage1) {
      return await this.redisService.getOrSet(cacheKey, 120, async () => {
        const rows = await this.postRepository.findFollowingPosts(
          userId,
          sanitizedCursor,
        );

        const posts = await Promise.all(
          rows.map(async (row) => {
            const brandName =
              (await this.brandService.resolveBrandName(row.brand_id)) ||
              undefined;
            return PostResponseDto.fromRow(row, undefined, brandName);
          }),
        );
        const nextCursor =
          rows.length === 10
            ? rows[rows.length - 1].created_at.toISOString()
            : null;

        return { posts, nextCursor };
      });
    }

    const rows = await this.postRepository.findFollowingPosts(
      userId,
      sanitizedCursor,
    );

    const posts = await Promise.all(
      rows.map(async (row) => {
        const brandName =
          (await this.brandService.resolveBrandName(row.brand_id)) || undefined;
        return PostResponseDto.fromRow(row, undefined, brandName);
      }),
    );
    const nextCursor =
      rows.length === 10
        ? rows[rows.length - 1].created_at.toISOString()
        : null;

    return { posts, nextCursor };
  }

  async getStatsWithFallback(
    postId: string,
  ): Promise<{ likeCount: number; commentCount: number }> {
    const cacheKey = REDIS_KEYS.POST.STATS(postId);
    return await this.redisService.getOrSet(cacheKey, 300, async () => {
      const dbStats = await this.postRepository.findPostStats(postId);
      return {
        likeCount: dbStats?.like_count || 0,
        commentCount: dbStats?.comment_count || 0,
      };
    });
  }

  async getUserPostCount(userId: string): Promise<number> {
    return await this.postRepository.findUserPostCount(userId);
  }

  async getUserPosts(
    userId: string,
    type: 'grid' | 'list',
    cursor?: string,
  ): Promise<UserProfilePostsResponseDto> {
    const limit = type === 'grid' ? 9 : 10;
    const sanitizedCursor =
      cursor === 'null' || cursor === 'undefined' ? undefined : cursor;

    const isPage1 = sanitizedCursor === undefined;
    const cacheKey = REDIS_KEYS.USER.POSTS(userId, type);

    if (isPage1) {
      return await this.redisService.getOrSet(cacheKey, 300, async () => {
        return await this.fetchUserPosts(userId, type, limit, sanitizedCursor);
      });
    }

    return await this.fetchUserPosts(userId, type, limit, sanitizedCursor);
  }

  private async fetchUserPosts(
    userId: string,
    type: 'grid' | 'list',
    limit: number,
    cursor?: string,
  ): Promise<UserProfilePostsResponseDto> {
    if (type === 'grid') {
      const rows = await this.postRepository.findUserPosts(
        userId,
        limit,
        cursor,
      );

      return {
        posts: rows.map((row) => ({
          photo: row.photo,
          postId: row.public_id,
          visibility: row.visibility,
        })),
        nextCursor:
          rows.length === limit
            ? rows[rows.length - 1].created_at.toISOString()
            : null,
      };
    } else {
      const rows = await this.postRepository.findUserPostsDetailed(
        userId,
        limit,
        cursor,
      );

      const listPosts = await Promise.all(
        rows.map(async (row) => {
          const brandName = await this.brandService.resolveBrandName(
            row.brand_id,
          );
          return PostResponseDto.fromRow(
            row,
            undefined,
            brandName || undefined,
          );
        }),
      );

      return {
        listPosts,
        nextCursor:
          rows.length === limit
            ? rows[rows.length - 1].created_at.toISOString()
            : null,
      };
    }
  }
}
