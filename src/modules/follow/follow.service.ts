import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FollowRepository, FollowListRow } from './follow.repository';
import {
  PaginatedFollowResponseDto,
  FollowUserItemDto,
} from './dto/follow-list.dto';
import { RedisService } from '../../providers/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import {
  UserFollowedEvent,
  UserUnfollowedEvent,
} from '../../common/events/interaction.events';

@Injectable()
export class FollowService {
  constructor(
    private readonly followRepository: FollowRepository,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async follow(
    followerId: string,
    followerNickname: string,
    followedId: string,
  ): Promise<void> {
    if (followerId === followedId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const alreadyFollowing = await this.isFollowing(followerId, followedId);
    if (alreadyFollowing) {
      throw new ConflictException('Already following this user');
    }

    const isNowMutual = await this.isFollowing(followedId, followerId);

    const queryRunner = await this.followRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.followRepository.follow(
        followerId,
        followedId,
        isNowMutual,
        queryRunner,
      );

      if (isNowMutual) {
        await this.followRepository.updateMutualStatus(
          followedId,
          followerId,
          true,
          queryRunner,
        );
      }

      await this.followRepository.incrementFollowCounts(
        followerId,
        followedId,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      await this.redisService.sadd(
        REDIS_KEYS.FOLLOW.SET(followerId),
        followedId,
      );

      this.eventEmitter.emit(
        'user.followed',
        new UserFollowedEvent(followerId, followerNickname, followedId),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    const isFollowing = await this.isFollowing(followerId, followedId);
    if (!isFollowing) {
      throw new NotFoundException('You are not following this user');
    }

    const wasMutual = await this.followRepository.isMutual(
      followerId,
      followedId,
    );

    const queryRunner = await this.followRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.followRepository.unfollow(followerId, followedId, queryRunner);

      if (wasMutual) {
        await this.followRepository.updateMutualStatus(
          followedId,
          followerId,
          false,
          queryRunner,
        );
      }

      await this.followRepository.decrementFollowCounts(
        followerId,
        followedId,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      await this.redisService.srem(
        REDIS_KEYS.FOLLOW.SET(followerId),
        followedId,
      );

      this.eventEmitter.emit(
        'user.unfollowed',
        new UserUnfollowedEvent(followerId, followedId),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getFollowers(
    userId: string,
    cursor: number | null,
  ): Promise<PaginatedFollowResponseDto> {
    const isPage1 = cursor === null;
    const cacheKey = REDIS_KEYS.FOLLOW.LIST(userId, 'followers');

    if (isPage1) {
      return await this.redisService.getOrSet(cacheKey, 300, async () => {
        const rows = await this.followRepository.findFollowList(
          'followed_user_id',
          'following_user_id',
          userId,
          cursor,
        );
        return this.mapToPaginatedResponse(rows);
      });
    }

    const rows = await this.followRepository.findFollowList(
      'followed_user_id',
      'following_user_id',
      userId,
      cursor,
    );
    return this.mapToPaginatedResponse(rows);
  }

  async getFollowing(
    userId: string,
    cursor: number | null,
  ): Promise<PaginatedFollowResponseDto> {
    const isPage1 = cursor === null;
    const cacheKey = REDIS_KEYS.FOLLOW.LIST(userId, 'following');

    if (isPage1) {
      return await this.redisService.getOrSet(cacheKey, 300, async () => {
        const rows = await this.followRepository.findFollowList(
          'following_user_id',
          'followed_user_id',
          userId,
          cursor,
        );
        return this.mapToPaginatedResponse(rows);
      });
    }

    const rows = await this.followRepository.findFollowList(
      'following_user_id',
      'followed_user_id',
      userId,
      cursor,
    );
    return this.mapToPaginatedResponse(rows);
  }

  private mapToPaginatedResponse(
    rows: FollowListRow[],
  ): PaginatedFollowResponseDto {
    const users: FollowUserItemDto[] = rows.map((row) => ({
      userId: row.public_id,
      nickname: row.nickname,
      profileUrl: row.profile_url || undefined,
      caffeineSum: row.caffeine_sum,
      visibility: row.visibility,
      cursorId: row.cursor_id,
    }));

    const nextCursor =
      rows.length === 10 ? rows[rows.length - 1].cursor_id : null;

    return {
      users,
      nextCursor,
    };
  }

  async isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const cacheKey = REDIS_KEYS.FOLLOW.SET(followerId);

    const inCache = await this.redisService.sismember(cacheKey, followedId);
    if (inCache) return true;

    const inDb = await this.followRepository.isFollowing(
      followerId,
      followedId,
    );
    if (inDb) {
      await this.redisService.sadd(cacheKey, followedId);
    }
    return inDb;
  }

  async areMutual(userIdA: string, userIdB: string): Promise<boolean> {
    return await this.followRepository.areMutual(userIdA, userIdB);
  }

  async getUsernameById(userId: string): Promise<string> {
    const nickname = await this.followRepository.getUsernameById(userId);
    if (!nickname) {
      throw new NotFoundException('User not found');
    }
    return nickname;
  }
}
