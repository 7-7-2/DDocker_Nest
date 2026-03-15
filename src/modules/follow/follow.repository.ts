import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';

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

  async follow(followerId: string, followedId: string): Promise<void> {
    const query = `
      INSERT INTO follows (following_user_id, followed_user_id) 
      VALUES (?, ?)
    `;
    await this.mysql.execute(query, [followerId, followedId]);
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    const query = `
      DELETE FROM follows 
      WHERE following_user_id = ? AND followed_user_id = ?
    `;
    await this.mysql.execute(query, [followerId, followedId]);
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
}
