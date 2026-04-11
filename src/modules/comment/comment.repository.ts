import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { QueryRunner } from 'typeorm';
import {
  CommentWithAuthorRow,
  ReplyWithAuthorRow,
} from './entities/comment.entity';

@Injectable()
export class CommentRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async insertComment(
    data: { user_id: string; post_id: string; content: string },
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const query = `
      INSERT INTO comment (user_id, post_id, content) 
      VALUES (?, ?, ?)
    `;
    const params = [data.user_id, data.post_id, data.content];

    if (queryRunner) {
      const header = await queryRunner.query(query, params);
      return header.insertId;
    }
    const header = await this.mysql.execute(query, params);
    return header.insertId;
  }

  async insertReply(
    data: {
      user_id: string;
      comment_id: number;
      post_id: string;
      content: string;
    },
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const query = `
      INSERT INTO reply (user_id, comment_id, content) 
      VALUES (?, ?, ?)
    `;
    const params = [data.user_id, data.comment_id, data.content];

    if (queryRunner) {
      const header = await queryRunner.query(query, params);
      return header.insertId;
    }
    const header = await this.mysql.execute(query, params);
    return header.insertId;
  }

  async incrementCommentCount(
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE post_stats 
      SET comment_count = comment_count + 1 
      WHERE post_id = ?
    `;
    if (queryRunner) {
      await queryRunner.query(query, [postId]);
    } else {
      await this.mysql.execute(query, [postId]);
    }
  }

  async decrementCommentCount(
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE post_stats 
      SET comment_count = GREATEST(0, comment_count - 1) 
      WHERE post_id = ?
    `;
    if (queryRunner) {
      await queryRunner.query(query, [postId]);
    } else {
      await this.mysql.execute(query, [postId]);
    }
  }

  async softDeleteComment(
    userId: string,
    commentId: number,
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE comment 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ? AND post_id = ?
    `;
    const params = [commentId, userId, postId];
    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async softDeleteReply(
    userId: string,
    replyId: number,
    commentId: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE reply 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE id = ? AND user_id = ? AND comment_id = ?
    `;
    const params = [replyId, userId, commentId];
    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async findCommentsByPost(postId: string): Promise<CommentWithAuthorRow[]> {
    const query = `
      SELECT 
        c.id, c.user_id, c.post_id, c.content, c.created_at, c.deleted_at,
        u.nickname, u.profile_url,
        (SELECT COUNT(*) FROM reply r WHERE r.comment_id = c.id AND r.deleted_at IS NULL) as reply_count
      FROM comment c
      INNER JOIN user u ON c.user_id = u.public_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `;
    return await this.mysql.query<CommentWithAuthorRow>(query, [postId]);
  }

  async findRepliesByComment(commentId: number): Promise<ReplyWithAuthorRow[]> {
    const query = `
      SELECT 
        r.id, r.user_id, r.comment_id, r.content, r.created_at, r.deleted_at,
        u.nickname, u.profile_url
      FROM reply r
      INNER JOIN user u ON r.user_id = u.public_id
      WHERE r.comment_id = ?
      ORDER BY r.created_at ASC
    `;
    return await this.mysql.query<ReplyWithAuthorRow>(query, [commentId]);
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
