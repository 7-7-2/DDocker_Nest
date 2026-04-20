import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';

export interface UserSearchRow {
  userId: string;
  nickname: string;
  url: string;
  caffeineSum: number;
}

export interface PostSearchRow {
  postId: string;
  description: string;
  photo: string | null;
  createdAt: Date;
  brandName: string;
  productName: string;
  likeCount: number;
  commentCount: number;
}

@Injectable()
export class SearchRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async searchUsersByNickname(
    nickname: string,
    limit: number,
    cursorNickname?: string,
    cursorId?: string,
  ): Promise<UserSearchRow[]> {
    let cursorCondition = '';
    const params: any[] = [`${nickname}%`];

    if (cursorNickname && cursorId) {
      cursorCondition = `AND (u.nickname, u.public_id) > (?, ?)`;
      params.push(cursorNickname, cursorId);
    }

    const query = `
      SELECT 
        u.public_id as userId, 
        u.nickname, 
        u.profile_url as url, 
        s.sum as caffeineSum
      FROM user u
      LEFT JOIN user_stats s ON u.public_id = s.user_id
      WHERE u.nickname LIKE ?
      ${cursorCondition}
      AND u.deleted_at IS NULL
      ORDER BY u.nickname ASC, u.public_id ASC
      LIMIT ?
    `;
    params.push(limit);

    return await this.mysql.query<UserSearchRow>(query, params);
  }

  async searchPostsByDescription(
    q: string,
    limit: number,
    sort: 'likes' | 'recent' = 'likes',
    cursor?: { likes?: number; date?: string; id?: string },
  ): Promise<PostSearchRow[]> {
    let cursorCondition = '';
    const params: any[] = [q];

    if (sort === 'likes') {
      if (cursor && cursor.likes !== undefined && cursor.id) {
        cursorCondition = `AND (ps.like_count, p.public_id) < (?, ?)`;
        params.push(cursor.likes, cursor.id);
      }
    } else {
      if (cursor && cursor.date && cursor.id) {
        cursorCondition = `AND (p.created_at, p.public_id) < (?, ?)`;
        params.push(cursor.date, cursor.id);
      }
    }

    const orderSql =
      sort === 'likes'
        ? 'ps.like_count DESC, p.public_id DESC'
        : 'p.created_at DESC, p.public_id DESC';

    const query = `
      SELECT 
        p.public_id as postId, 
        p.description, 
        p.photo, 
        p.created_at as createdAt,
        b.brand_name as brandName,
        ci.product_name as productName,
        ps.like_count as likeCount,
        ps.comment_count as commentCount
      FROM post p
      INNER JOIN user u ON p.user_id = u.public_id
      INNER JOIN caffeine_intake ci ON p.caffeine_intake_id = ci.id
      INNER JOIN brand b ON ci.brand_id = b.id
      LEFT JOIN post_stats ps ON p.public_id = ps.post_id
      WHERE MATCH(p.description) AGAINST(? IN BOOLEAN MODE)
        AND p.deleted_at IS NULL
        AND p.visibility = 1
        AND u.deleted_at IS NULL
        AND u.visibility = 1
        ${cursorCondition}
      ORDER BY ${orderSql}
      LIMIT ?
    `;
    params.push(limit);

    return await this.mysql.query<PostSearchRow>(query, params);
  }
}
