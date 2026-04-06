import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { PostStatsRow } from './entities/post.entity';
import { PostDetailRow, PostFeedRow } from './entities/post-query.entity';
import { QueryRunner } from 'typeorm';

@Injectable()
export class PostRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async findPostDetail(postId: string): Promise<PostDetailRow> {
    const query = `
      SELECT 
        p.user_id, p.caffeine_intake_id, 
        p.photo, p.public_id, p.description, p.created_at, p.updated_at, p.visibility,
        u.nickname, u.profile_url, us.sum as user_sum,
        i.brand_id, i.caffeine, i.product_name, i.size, i.shot, i.intensity
      FROM post p
      INNER JOIN user u ON p.user_id = u.public_id
      LEFT JOIN user_stats us ON u.public_id = us.user_id
      INNER JOIN caffeine_intake i ON p.caffeine_intake_id = i.id
      WHERE p.public_id = ? AND p.deleted_at IS NULL
      LIMIT 1
    `;
    const results = await this.mysql.query<PostDetailRow>(query, [postId]);
    return results[0];
  }

  async findFollowingPosts(
    userId: string,
    cursorDate?: string | null,
  ): Promise<PostFeedRow[]> {
    const query = `
      SELECT 
        p.user_id, p.caffeine_intake_id, p.photo, p.public_id, 
        p.description, p.created_at, p.visibility,
        u.nickname, u.profile_url,
        us.sum as user_sum,
        ps.like_count, ps.comment_count,
        i.brand_id, i.caffeine, i.product_name, i.size, i.shot, i.intensity
      FROM post p
      INNER JOIN follows f ON p.user_id = f.followed_user_id
      INNER JOIN user u ON p.user_id = u.public_id
      LEFT JOIN user_stats us ON p.user_id = us.user_id
      INNER JOIN post_stats ps ON p.public_id = ps.post_id
      INNER JOIN caffeine_intake i ON p.caffeine_intake_id = i.id
      WHERE f.following_user_id = ?
        AND p.deleted_at IS NULL
        AND p.visibility = 1
        AND (u.visibility = 1 OR f.is_mutual = 1)
        ${cursorDate ? 'AND p.created_at < ?' : ''}
      ORDER BY p.created_at DESC
      LIMIT 10
    `;
    const params = cursorDate ? [userId, cursorDate] : [userId];
    return await this.mysql.query<PostFeedRow>(query, params);
  }

  async findPostStats(postId: string): Promise<PostStatsRow> {
    const query = `
      SELECT post_id, like_count, comment_count 
      FROM post_stats 
      WHERE post_id = ?
    `;
    const results = await this.mysql.query<PostStatsRow>(query, [postId]);
    return results[0];
  }

  async insertPost(
    data: {
      user_id: string;
      caffeine_intake_id: number;
      photo?: string;
      public_id: string;
      description?: string;
      visibility: number;
    },
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      INSERT INTO post (
        user_id, caffeine_intake_id, photo, 
        public_id, description, visibility
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.user_id,
      data.caffeine_intake_id,
      data.photo || null,
      data.public_id,
      data.description || null,
      data.visibility,
    ];

    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async insertPostStats(
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      INSERT INTO post_stats (post_id, like_count, comment_count) 
      VALUES (?, 0, 0)
    `;
    if (queryRunner) {
      await queryRunner.query(query, [postId]);
    } else {
      await this.mysql.execute(query, [postId]);
    }
  }

  async patchPost(postId: string, dto: any): Promise<void> {
    const buildResult = this.buildUpdateQuery('post', dto, 'public_id', postId);
    if (!buildResult) return;

    await this.mysql.execute(buildResult.query, buildResult.params);
  }

  async findUserPosts(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<
    { photo: string; public_id: string; visibility: number; created_at: Date }[]
  > {
    const query = `
      SELECT photo, public_id, visibility, created_at
      FROM post
      WHERE user_id = ? AND deleted_at IS NULL
      ${cursor ? 'AND created_at < ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;
    const params = cursor ? [userId, cursor, limit] : [userId, limit];
    return await this.mysql.query(query, params);
  }

  async findUserPostsDetailed(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<
    {
      public_id: string;
      visibility: number;
      caffeine: number;
      description: string;
      photo: string;
      product_name: string;
      brand_id: number;
      created_at: Date;
    }[]
  > {
    const query = `
      SELECT 
        p.public_id, p.visibility, p.description, p.photo, p.created_at,
        i.caffeine, i.product_name, i.brand_id
      FROM post p
      INNER JOIN caffeine_intake i ON p.caffeine_intake_id = i.id
      WHERE p.user_id = ? AND p.deleted_at IS NULL
      ${cursor ? 'AND p.created_at < ?' : ''}
      ORDER BY p.created_at DESC
      LIMIT ?
    `;
    const params = cursor ? [userId, cursor, limit] : [userId, limit];
    return await this.mysql.query(query, params);
  }

  async countUserPosts(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM post 
      WHERE user_id = ? AND deleted_at IS NULL
    `;
    const result = await this.mysql.query<{ count: string }>(query, [userId]);
    return parseInt(result[0].count, 10);
  }

  async findUserPostCount(userId: string): Promise<number> {
    const query = `
      SELECT post_count 
      FROM user_stats 
      WHERE user_id = ?
    `;
    const result = await this.mysql.query<{ post_count: number }>(query, [
      userId,
    ]);
    return result[0]?.post_count || 0;
  }

  async updateUserStatsPostCount(
    userId: string,
    increment: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE user_stats 
      SET post_count = post_count + ? 
      WHERE user_id = ?
    `;
    const params = [increment, userId];

    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async softDeletePost(
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE post 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE public_id = ? AND deleted_at IS NULL
    `;
    if (queryRunner) {
      await queryRunner.query(query, [postId]);
    } else {
      await this.mysql.execute(query, [postId]);
    }
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
