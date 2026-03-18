import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LikeRepository } from './like.repository';
import { RedisService } from '../../providers/redis/redis.service';

@Injectable()
export class LikeService {
  private readonly REDIS_PREFIX = 'post_likes:';

  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly redisService: RedisService,
  ) {}

  async likePost(userId: string, postId: string): Promise<void> {
    const isLiked = await this.isLiked(userId, postId);
    if (isLiked) {
      throw new ConflictException('Already liked this post');
    }

    const queryRunner = await this.likeRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.likeRepository.insertLike(userId, postId, queryRunner);
      await this.likeRepository.updateLikeCount(postId, 1, queryRunner);

      await queryRunner.commitTransaction();

      await this.redisService.sadd(`${this.REDIS_PREFIX}${postId}`, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to like post');
    } finally {
      await queryRunner.release();
    }
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    const isLiked = await this.isLiked(userId, postId);
    if (!isLiked) {
      throw new NotFoundException('Like not found');
    }

    const queryRunner = await this.likeRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.likeRepository.deleteLike(userId, postId, queryRunner);
      await this.likeRepository.updateLikeCount(postId, -1, queryRunner);

      await queryRunner.commitTransaction();

      await this.redisService.srem(`${this.REDIS_PREFIX}${postId}`, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to unlike post');
    } finally {
      await queryRunner.release();
    }
  }

  async isLiked(userId: string, postId: string): Promise<boolean> {
    const cacheKey = `${this.REDIS_PREFIX}${postId}`;

    const inCache = await this.redisService.sismember(cacheKey, userId);
    if (inCache) return true;

    const inDb = await this.likeRepository.findLike(userId, postId);

    if (inDb) {
      await this.redisService.sadd(cacheKey, userId);
    }

    return inDb;
  }
}
