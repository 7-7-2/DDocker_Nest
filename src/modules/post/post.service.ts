import { Injectable } from '@nestjs/common';
import { PostRepository } from './post.repository';
import {
  PostResponseDto,
  PaginatedPostResponseDto,
  SocialCountsResponseDto,
} from './dto/post-response.dto';
import { PostDetailRow, PostFeedRow } from './entities/post-query.entity';
import { RedisService } from '../../providers/redis/redis.service';

@Injectable()
export class PostService {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly redisService: RedisService,
  ) {}

  async getPostDetail(postId: string): Promise<PostResponseDto> {
    const stats = await this.getStatsWithFallback(postId);
    const row = await this.postRepository.findPostDetail(postId);

    return this.mapDetailRowToDto(row, { ...stats });
  }

  async getFollowingPosts(
    userId: string,
    cursor: string | null,
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
      // Caffeine Details (Combined into DTO)
      brandId: row.brand_id,
      caffeine: row.caffeine,
      productName: row.product_name,
      size: row.size,
      shot: row.shot,
      intensity: row.intensity,
      userSum: row.user_sum,
      cursorId: row.id,
    };
  }
}
