import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { LikeRepository } from './like.repository';
import { RedisService } from '../../providers/redis/redis.service';
import { PostRepository } from '../post/post.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import {
  PostLikedEvent,
  PostUnlikedEvent,
} from '../../common/events/interaction.events';

@Injectable()
export class LikeService {
  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly redisService: RedisService,
    private readonly postRepository: PostRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async likePost(
    userId: string,
    likerNickname: string,
    postId: string,
  ): Promise<void> {
    const isLiked = await this.isLiked(userId, postId);
    if (isLiked) {
      throw new ConflictException('Already liked this post');
    }

    const post = await this.postRepository.findPostDetail(postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const queryRunner = await this.likeRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.likeRepository.insertLike(userId, postId, queryRunner);
      await this.likeRepository.updateLikeCount(postId, 1, queryRunner);

      await queryRunner.commitTransaction();

      await this.redisService.sadd(REDIS_KEYS.POST.LIKES(postId), userId);

      this.eventEmitter.emit(
        'post.liked',
        new PostLikedEvent(userId, likerNickname, postId, post.user_id),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
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

      await this.redisService.srem(REDIS_KEYS.POST.LIKES(postId), userId);

      this.eventEmitter.emit(
        'post.unliked',
        new PostUnlikedEvent(userId, postId),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to unlike post');
    } finally {
      await queryRunner.release();
    }
  }

  async isLiked(userId: string, postId: string): Promise<boolean> {
    const cacheKey = REDIS_KEYS.POST.LIKES(postId);

    const inCache = await this.redisService.sismember(cacheKey, userId);
    if (inCache) return true;

    const inDb = await this.likeRepository.findLike(userId, postId);

    if (inDb) {
      await this.redisService.sadd(cacheKey, userId);
    }

    return inDb;
  }
}
