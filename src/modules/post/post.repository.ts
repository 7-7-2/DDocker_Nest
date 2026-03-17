import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { PostStatsRow } from './entities/post.entity';
import { PostDetailRow, PostFeedRow } from './entities/post-query.entity';

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
    cursorDate: string | null,
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
}
