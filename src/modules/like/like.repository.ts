import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { QueryRunner } from 'typeorm';

@Injectable()
export class LikeRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async insertLike(
    userId: string,
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `INSERT INTO likes (user_id, post_id) VALUES (?, ?)`;
    if (queryRunner) {
      await queryRunner.query(query, [userId, postId]);
    } else {
      await this.mysql.execute(query, [userId, postId]);
    }
  }

  async deleteLike(
    userId: string,
    postId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `DELETE FROM likes WHERE user_id = ? AND post_id = ?`;
    if (queryRunner) {
      await queryRunner.query(query, [userId, postId]);
    } else {
      await this.mysql.execute(query, [userId, postId]);
    }
  }

  async findLike(userId: string, postId: string): Promise<boolean> {
    const query = `
      SELECT user_id 
      FROM likes 
      WHERE user_id = ? AND post_id = ? 
      LIMIT 1
    `;
    const results = await this.mysql.query<{ user_id: string }>(query, [
      userId,
      postId,
    ]);
    return results.length > 0;
  }

  async updateLikeCount(
    postId: string,
    increment: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE post_stats 
      SET like_count = like_count + ? 
      WHERE post_id = ?
    `;
    const params = [increment, postId];
    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
