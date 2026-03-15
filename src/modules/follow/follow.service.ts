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

@Injectable()
export class FollowService {
  constructor(private readonly followRepository: FollowRepository) {}

  async follow(followerId: string, followedId: string): Promise<void> {
    if (followerId === followedId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const alreadyFollowing = await this.followRepository.isFollowing(
      followerId,
      followedId,
    );
    if (alreadyFollowing) {
      throw new ConflictException('Already following this user');
    }

    await this.followRepository.follow(followerId, followedId);
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    const isFollowing = await this.followRepository.isFollowing(
      followerId,
      followedId,
    );
    if (!isFollowing) {
      throw new NotFoundException('You are not following this user');
    }

    await this.followRepository.unfollow(followerId, followedId);
  }

  async getFollowers(
    userId: string,
    cursor: number | null,
  ): Promise<PaginatedFollowResponseDto> {
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
    return await this.followRepository.isFollowing(followerId, followedId);
  }

  async areMutual(userIdA: string, userIdB: string): Promise<boolean> {
    return await this.followRepository.areMutual(userIdA, userIdB);
  }
}
