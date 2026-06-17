import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RedisService } from '../../providers/redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import {
  PostLikedEvent,
  PostUnlikedEvent,
  CommentCreatedEvent,
  ReplyCreatedEvent,
  CommentDeletedEvent,
  ReplyDeletedEvent,
  UserFollowedEvent,
  UserUnfollowedEvent,
} from '../../common/events/interaction.events';

@Injectable()
export class InteractionListener {
  private readonly logger = new Logger(InteractionListener.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly notificationService: NotificationService,
  ) {}

  private async withRetry(
    taskName: string,
    fn: () => Promise<void>,
    retries = 3,
  ) {
    for (let i = 0; i < retries; i++) {
      try {
        await fn();
        return;
      } catch (error) {
        const delay = 1000 * Math.pow(2, i);
        this.logger.warn(
          `Task "${taskName}" failed (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`,
        );
        if (i === retries - 1) {
          this.logger.error(
            `Task "${taskName}" failed after ${retries} attempts.`,
            error.stack,
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  }

  @OnEvent('post.liked')
  async handlePostLiked(event: PostLikedEvent) {
    // Cache Invalidation
    await this.redisService.del(REDIS_KEYS.POST.STATS(event.postId));

    // Notification (with retry)
    if (event.userId !== event.postOwnerId) {
      await this.withRetry('PostLikedNotification', async () => {
        await this.notificationService.pushNotification(event.postOwnerId, {
          type: 'like',
          senderId: event.userId,
          senderNickname: event.likerNickname,
          postId: event.postId,
          time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
        });
      });
    }
  }

  @OnEvent('post.unliked')
  async handlePostUnliked(event: PostUnlikedEvent) {
    await this.redisService.del(REDIS_KEYS.POST.STATS(event.postId));
  }

  @OnEvent('comment.created')
  async handleCommentCreated(event: CommentCreatedEvent) {
    await this.redisService.del([
      REDIS_KEYS.POST.COMMENTS(event.postId),
      REDIS_KEYS.POST.STATS(event.postId),
    ]);

    if (event.userId !== event.postOwnerId) {
      await this.withRetry('CommentCreatedNotification', async () => {
        await this.notificationService.pushNotification(event.postOwnerId, {
          type: 'comment',
          senderId: event.userId,
          senderNickname: event.commenterNickname,
          postId: event.postId,
          time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
        });
      });
    }
  }

  @OnEvent('reply.created')
  async handleReplyCreated(event: ReplyCreatedEvent) {
    await this.redisService.del([
      REDIS_KEYS.POST.COMMENTS(event.postId),
      REDIS_KEYS.COMMENT.REPLIES(event.commentId),
      REDIS_KEYS.POST.STATS(event.postId),
    ]);
    // Notification logic for replies could be added here if needed
  }

  @OnEvent('comment.deleted')
  async handleCommentDeleted(event: CommentDeletedEvent) {
    await this.redisService.del([
      REDIS_KEYS.POST.COMMENTS(event.postId),
      REDIS_KEYS.POST.STATS(event.postId),
    ]);
  }

  @OnEvent('reply.deleted')
  async handleReplyDeleted(event: ReplyDeletedEvent) {
    await this.redisService.del([
      REDIS_KEYS.COMMENT.REPLIES(event.commentId),
      REDIS_KEYS.POST.COMMENTS(event.postId),
      REDIS_KEYS.POST.STATS(event.postId),
    ]);
  }

  @OnEvent('user.followed')
  async handleUserFollowed(event: UserFollowedEvent) {
    // Cache Invalidation
    const keys = [
      REDIS_KEYS.USER.PROFILE(event.followerId),
      REDIS_KEYS.USER.PROFILE(event.followedId),
      REDIS_KEYS.USER.STATS(event.followerId),
      REDIS_KEYS.USER.STATS(event.followedId),
      REDIS_KEYS.FOLLOW.LIST(event.followerId, 'following'),
      REDIS_KEYS.FOLLOW.LIST(event.followedId, 'followers'),
    ];
    await this.redisService.del(keys);

    // Notification
    await this.withRetry('UserFollowedNotification', async () => {
      await this.notificationService.pushNotification(event.followedId, {
        type: 'follow',
        senderId: event.followerId,
        senderNickname: event.followerNickname,
        time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
      });
    });
  }

  @OnEvent('user.unfollowed')
  async handleUserUnfollowed(event: UserUnfollowedEvent) {
    const keys = [
      REDIS_KEYS.USER.PROFILE(event.followerId),
      REDIS_KEYS.USER.PROFILE(event.followedId),
      REDIS_KEYS.USER.STATS(event.followerId),
      REDIS_KEYS.USER.STATS(event.followedId),
      REDIS_KEYS.FOLLOW.LIST(event.followerId, 'following'),
      REDIS_KEYS.FOLLOW.LIST(event.followedId, 'followers'),
    ];
    await this.redisService.del(keys);
  }
}
