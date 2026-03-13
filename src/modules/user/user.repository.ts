import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { UserRow } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryRunner } from 'typeorm';

/**
 * Raw database result combining user and their stats.
 */
export interface UserWithStatsRow extends UserRow {
  sum: number;
}

@Injectable()
export class UserRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async insertUser(
    data: {
      public_id: string;
      useremail: string;
      nickname: string;
      fav_brand_id: number;
      profile_url?: string;
      bio?: string;
      social: string;
    },
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      INSERT INTO user (
        public_id, 
        useremail, 
        nickname, 
        fav_brand_id, 
        profile_url, 
        bio, 
        social
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.public_id,
      data.useremail,
      data.nickname,
      data.fav_brand_id,
      data.profile_url || null,
      data.bio || null,
      data.social,
    ];

    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async insertInitStats(
    userId: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `INSERT INTO user_stats (user_id, sum) VALUES (?, 0)`;
    if (queryRunner) {
      await queryRunner.query(query, [userId]);
    } else {
      await this.mysql.execute(query, [userId]);
    }
  }

  /**
   * findByPublicId using explicit projection to avoid SELECT *.
   */
  async findByPublicId(publicId: string): Promise<UserRow | null> {
    const query = `
      SELECT 
        id, public_id, useremail, nickname, profile_url, 
        fav_brand_id, social, bio, created_at, updated_at, 
        deleted_at
      FROM user 
      WHERE public_id = ? AND deleted_at IS NULL
    `;
    const results = await this.mysql.query<UserRow>(query, [publicId]);
    return results[0] || null;
  }

  /**
   * findByEmailAndProvider using explicit projection and index-friendly WHERE.
   */
  async findByEmailAndProvider(
    email: string,
    social: string,
  ): Promise<UserRow | null> {
    const query = `
      SELECT 
        id, public_id, useremail, nickname, profile_url, 
        fav_brand_id, social, bio, created_at, updated_at, 
        deleted_at
      FROM user 
      WHERE useremail = ? AND social = ? AND deleted_at IS NULL
    `;
    const results = await this.mysql.query<UserRow>(query, [email, social]);
    return results[0] || null;
  }

  /**
   * findUserWithStats using explicit projection.
   */
  async findUserWithStats(publicId: string): Promise<UserWithStatsRow | null> {
    const query = `
      SELECT 
        u.public_id, 
        u.nickname, 
        u.profile_url, 
        u.bio, 
        u.fav_brand_id,
        us.sum
      FROM user u
      LEFT JOIN user_stats us ON u.public_id = us.user_id
      WHERE u.public_id = ? AND u.deleted_at IS NULL
    `;
    const results = await this.mysql.query<UserWithStatsRow>(query, [publicId]);
    return results[0] || null;
  }

  async patchUserProfile(userId: string, dto: UpdateUserDto): Promise<void> {
    const buildResult = this.buildUpdateQuery('user', dto, 'public_id', userId);
    if (!buildResult) return;

    await this.mysql.execute(buildResult.query, buildResult.params);
  }

  async deleteAccount(userId: string): Promise<void> {
    const query = `
      UPDATE user 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE public_id = ? AND deleted_at IS NULL
    `;
    await this.mysql.execute(query, [userId]);
  }

  async checkNickname(nickname: string): Promise<boolean> {
    const query = `
      SELECT id 
      FROM user 
      WHERE nickname = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const results = await this.mysql.query<Pick<UserRow, 'id'>>(query, [
      nickname,
    ]);
    return results.length > 0;
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
