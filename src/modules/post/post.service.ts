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
  SocialCountsResponseDto,
} from './dto/post-response.dto';
import { PostDetailRow, PostFeedRow } from './entities/post-query.entity';
import { RedisService } from '../../providers/redis/redis.service';
import { CaffeineService } from '../caffeine/caffeine.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CaffeineRepository } from '../caffeine/caffeine.repository';
import { UserProfilePostsResponseDto } from '../user/dto/user-profile-posts.dto';
import { BrandService } from '../brand/brand.service';

@Injectable()
export class PostService {
  private readonly logger = new Logger(PostService.name);

  constructor(
    private readonly postRepository: PostRepository,
    private readonly redisService: RedisService,
    private readonly caffeineService: CaffeineService,
    private readonly caffeineRepository: CaffeineRepository,
    private readonly brandService: BrandService,
  ) {}

  async registerPost(userId: string, dto: CreatePostDto): Promise<void> {
    const brandId = await this.brandService.resolveBrandId(dto.brand);
    if (!brandId) {
      throw new BadRequestException(`Invalid brand: ${dto.brand}`);
    }

    const queryRunner = await this.postRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const intakeId = await this.caffeineService.logIntake(
        userId,
        {
          brandId: brandId,
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

      await queryRunner.commitTransaction();

      await this.redisService.del(`user:stats:${userId}`);

      this.logger.log(`Post ${dto.postId} registered for user ${userId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to register post for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to register post');
    } finally {
      await queryRunner.release();
    }
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

    const queryRunner = await this.postRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
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

      await queryRunner.commitTransaction();

      await this.redisService.del([
        `user:stats:${userId}`,
        `post:detail:${postId}`,
        `post:stats:${postId}`,
      ]);

      this.logger.log(`Post ${postId} deleted for user ${userId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to delete post ${postId}`, error);
      throw new InternalServerErrorException('Failed to delete post');
    } finally {
      await queryRunner.release();
    }
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
  }

  async getPostDetail(postId: string): Promise<PostResponseDto> {
    const cacheKey = `post:detail:${postId}`;
    return await this.redisService.getOrSet(cacheKey, 300, async () => {
      const stats = await this.getStatsWithFallback(postId);
      const row = await this.postRepository.findPostDetail(postId);
      if (!row) throw new NotFoundException('Post not found');

      return await this.mapDetailRowToDto(row, { ...stats });
    });
  }

  async getFollowingPosts(
    userId: string,
    cursor?: string | null,
  ): Promise<PaginatedPostResponseDto> {
    const sanitizedCursor =
      cursor === 'null' || cursor === 'undefined' ? null : cursor;

    const isPage1 = sanitizedCursor === null;
    const cacheKey = `post:feed:following:${userId}`;

    if (isPage1) {
      return await this.redisService.getOrSet(cacheKey, 120, async () => {
        const rows = await this.postRepository.findFollowingPosts(
          userId,
          sanitizedCursor,
        );

        const posts = await Promise.all(
          rows.map((row) => this.mapDetailRowToDto(row)),
        );
        const nextCursor =
          rows.length === 10
            ? rows[rows.length - 1].created_at.toISOString()
            : null;

        return {
          posts,
          nextCursor,
        };
      });
    }

    const rows = await this.postRepository.findFollowingPosts(
      userId,
      sanitizedCursor,
    );

    const posts = await Promise.all(
      rows.map((row) => this.mapDetailRowToDto(row)),
    );
    const nextCursor =
      rows.length === 10
        ? rows[rows.length - 1].created_at.toISOString()
        : null;

    return {
      posts,
      nextCursor,
    };
  }

  private async getPostSocialCounts(
    postId: string,
  ): Promise<SocialCountsResponseDto | null> {
    const cacheKey = `post_stats:${postId}`;
    return await this.redisService.get<SocialCountsResponseDto>(cacheKey);
  }

  async getStatsWithFallback(
    postId: string,
  ): Promise<{ likeCount: number; commentCount: number }> {
    const cacheKey = `post_stats:${postId}`;
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
    const cacheKey = `user:posts:${userId}:${type}:page1`;

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

      return {
        listPosts: await Promise.all(
          rows.map(async (row) => ({
            postId: row.public_id,
            visibility: row.visibility,
            caffeine: row.caffeine,
            description: row.description,
            photo: row.photo,
            productName: row.product_name,
            brandId: row.brand_id,
            brand: (await this.brandService.resolveBrandName(row.brand_id)) || undefined,
            createdAt: row.created_at,
          })),
        ),
        nextCursor:
          rows.length === limit
            ? rows[rows.length - 1].created_at.toISOString()
            : null,
      };
    }
  }

  private async mapDetailRowToDto(
    row: PostDetailRow | PostFeedRow,
    stats?: { likeCount: number; commentCount: number },
  ): Promise<PostResponseDto> {
    const likeCount = stats ? stats.likeCount : (row as PostFeedRow).like_count;
    const commentCount = stats
      ? stats.commentCount
      : (row as PostFeedRow).comment_count;

    const brandName = await this.brandService.resolveBrandName(row.brand_id);

    return {
      postId: row.public_id,
      userId: row.user_id,
      nickname: row.nickname,
      profileUrl: row.profile_url,
      photo: row.photo,
      description: row.description,
      createdAt: row.created_at,
      likeCount: likeCount || 0,
      commentCount: commentCount || 0,
      visibility: row.visibility,
      brandId: row.brand_id,
      brand: brandName || undefined,
      caffeine: row.caffeine,
      productName: row.product_name,
      size: row.size,
      shot: row.shot,
      intensity: row.intensity,
      userSum: row.user_sum || 0,
      cursorId: row.id,
    };
  }
}
