import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
  Logger,
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
import { TransactionManager } from '../../common/database/transaction.manager';

@Injectable()
export class LikeService {
  private readonly logger = new Logger(LikeService.name);

  constructor(
    private readonly likeRepository: LikeRepository,
    private readonly redisService: RedisService,
    private readonly postRepository: PostRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly txManager: TransactionManager,
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

    await this.txManager.run(
      async (queryRunner) => {
        await this.likeRepository.insertLike(userId, postId, queryRunner);
        await this.likeRepository.updateLikeCount(postId, 1, queryRunner);
      },
      {
        logger: this.logger,
        context: 'likePost',
        message: 'Failed to like post',
      },
    );

    await this.redisService.sadd(REDIS_KEYS.POST.LIKES(postId), userId);

    this.eventEmitter.emit(
      'post.liked',
      new PostLikedEvent(userId, likerNickname, postId, post.user_id),
    );
  }

  async unlikePost(userId: string, postId: string): Promise<void> {
    const isLiked = await this.isLiked(userId, postId);
    if (!isLiked) {
      throw new NotFoundException('Like not found');
    }

    await this.txManager.run(
      async (queryRunner) => {
        await this.likeRepository.deleteLike(userId, postId, queryRunner);
        await this.likeRepository.updateLikeCount(postId, -1, queryRunner);
      },
      {
        logger: this.logger,
        context: 'unlikePost',
        message: 'Failed to unlike post',
      },
    );

    await this.redisService.srem(REDIS_KEYS.POST.LIKES(postId), userId);

    this.eventEmitter.emit(
      'post.unliked',
      new PostUnlikedEvent(userId, postId),
    );
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
