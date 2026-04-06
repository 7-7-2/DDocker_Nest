import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { QueryRunner } from 'typeorm/query-runner/QueryRunner';

export interface FollowListRow {
  public_id: string;
  nickname: string;
  profile_url: string | null;
  caffeine_sum: number;
  cursor_id: number;
}

@Injectable()
export class FollowRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async follow(
    followerId: string,
    followedId: string,
    isMutual: boolean = false,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      INSERT INTO follows (following_user_id, followed_user_id, is_mutual) 
      VALUES (?, ?, ?)
    `;
    const params = [followerId, followedId, isMutual ? 1 : 0];
    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async updateMutualStatus(
    followingId: string,
    followedId: string,
    isMutual: boolean,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE follows 
      SET is_mutual = ? 
      WHERE following_user_id = ? AND followed_user_id = ?
    `;
    const params = [isMutual ? 1 : 0, followingId, followedId];
    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async unfollow(
    followerId: string,
    followedId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      DELETE FROM follows 
      WHERE following_user_id = ? AND followed_user_id = ?
    `;
    const params = [followerId, followedId];
    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async isMutual(followerId: string, followedId: string): Promise<boolean> {
    const query = `
      SELECT is_mutual 
      FROM follows 
      WHERE following_user_id = ? AND followed_user_id = ?
      LIMIT 1
    `;
    const results = await this.mysql.query<{ is_mutual: number }>(query, [
      followerId,
      followedId,
    ]);
    return results[0]?.is_mutual === 1;
  }

  async isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const query = `
      SELECT following_user_id 
      FROM follows 
      WHERE following_user_id = ? AND followed_user_id = ?
      LIMIT 1
    `;
    const results = await this.mysql.query<{ following_user_id: string }>(
      query,
      [followerId, followedId],
    );
    return results.length > 0;
  }

  async areMutual(userIdA: string, userIdB: string): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as count 
      FROM follows 
      WHERE (following_user_id = ? AND followed_user_id = ?)
         OR (following_user_id = ? AND followed_user_id = ?)
    `;
    const results = await this.mysql.query<{ count: string }>(query, [
      userIdA,
      userIdB,
      userIdB,
      userIdA,
    ]);

    return +results[0].count === 2;
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }

  async findFollowList(
    filterCol: 'following_user_id' | 'followed_user_id',
    targetCol: 'following_user_id' | 'followed_user_id',
    userId: string,
    cursor: number | null,
  ): Promise<FollowListRow[]> {
    const query = `
      SELECT 
        u.public_id, u.nickname, u.profile_url, 
        COALESCE(us.sum, 0) as caffeine_sum,
        f.id as cursor_id
      FROM follows f
      INNER JOIN user u ON u.public_id = f.${targetCol}
      LEFT JOIN user_stats us ON us.user_id = u.public_id
      WHERE f.${filterCol} = ?
        ${cursor ? 'AND f.id < ?' : ''}
      ORDER BY f.id DESC
      LIMIT 10
    `;
    const params = cursor ? [userId, cursor] : [userId];
    return await this.mysql.query<FollowListRow>(query, params);
  }

  async incrementFollowCounts(
    followerId: string,
    followedId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const incrementFollowing = `
      UPDATE user_stats 
      SET following_count = following_count + 1 
      WHERE user_id = ?
    `;
    const incrementFollower = `
      UPDATE user_stats 
      SET follower_count = follower_count + 1 
      WHERE user_id = ?
    `;

    if (queryRunner) {
      await queryRunner.query(incrementFollowing, [followerId]);
      await queryRunner.query(incrementFollower, [followedId]);
    } else {
      await this.mysql.execute(incrementFollowing, [followerId]);
      await this.mysql.execute(incrementFollower, [followedId]);
    }
  }

  async decrementFollowCounts(
    followerId: string,
    followedId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const decrementFollowing = `
      UPDATE user_stats 
      SET following_count = GREATEST(0, following_count - 1) 
      WHERE user_id = ?
    `;
    const decrementFollower = `
      UPDATE user_stats 
      SET follower_count = GREATEST(0, follower_count - 1) 
      WHERE user_id = ?
    `;

    if (queryRunner) {
      await queryRunner.query(decrementFollowing, [followerId]);
      await queryRunner.query(decrementFollower, [followedId]);
    } else {
      await this.mysql.execute(decrementFollowing, [followerId]);
      await this.mysql.execute(decrementFollower, [followedId]);
    }
  }

  async getUsernameById(userId: string): Promise<string | null> {
    const query = `
      SELECT nickname 
      FROM user 
      WHERE public_id = ? AND deleted_at IS NULL
    `;
    const results = await this.mysql.query<{ nickname: string }>(query, [
      userId,
    ]);
    return results[0]?.nickname || null;
  }
}
