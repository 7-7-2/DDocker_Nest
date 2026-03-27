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
    const brandId = await this.brandService.resolveBrandId(dto.brandId);
    if (!brandId) {
      throw new BadRequestException(`Invalid brand: ${dto.brandId}`);
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

      await this.postRepository.updateUserStatsPostCount(userId, 1, queryRunner);

      await queryRunner.commitTransaction();
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
    const stats = await this.getStatsWithFallback(postId);
    const row = await this.postRepository.findPostDetail(postId);
    if (!row) throw new NotFoundException('Post not found');

    return this.mapDetailRowToDto(row, { ...stats });
  }

  async getFollowingPosts(
    userId: string,
    cursor?: string | null,
  ): Promise<PaginatedPostResponseDto> {
    const rows = await this.postRepository.findFollowingPosts(userId, cursor);

    const posts = rows.map((row) => this.mapDetailRowToDto(row));
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
    const cached = await this.redisService.get<{
      likeCount: number;
      commentCount: number;
    }>(cacheKey);

    return cached;
  }

  async getStatsWithFallback(
    postId: string,
  ): Promise<{ likeCount: number; commentCount: number }> {
    const cacheKey = `post_stats:${postId}`;
    const cached = await this.getPostSocialCounts(postId);
    if (cached) return cached;

    const dbStats = await this.postRepository.findPostStats(postId);
    const stats = {
      likeCount: dbStats?.like_count || 0,
      commentCount: dbStats?.comment_count || 0,
    };

    await this.redisService.set(cacheKey, stats, 300);

    return stats;
  }

  async getUserPosts(
    userId: string,
    page: number,
  ): Promise<UserProfilePostsResponseDto> {
    const limit = 18;
    const offset = page * limit;

    const [rows, count] = await Promise.all([
      this.postRepository.findUserPosts(userId, limit, offset),
      this.postRepository.findUserPostCount(userId),
    ]);

    return {
      allCount: count,
      posts: rows.map((row) => ({
        photo: row.photo,
        postId: row.public_id,
      })),
    };
  }

  private mapDetailRowToDto(
    row: PostDetailRow | PostFeedRow,
    stats?: { likeCount: number; commentCount: number },
  ): PostResponseDto {
    const likeCount = stats ? stats.likeCount : (row as PostFeedRow).like_count;
    const commentCount = stats
      ? stats.commentCount
      : (row as PostFeedRow).comment_count;

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
