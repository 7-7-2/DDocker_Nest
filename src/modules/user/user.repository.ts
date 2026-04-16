import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { UserRow } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryRunner } from 'typeorm';

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
      visibility: number;
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
        social,
        visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.public_id,
      data.useremail,
      data.nickname,
      data.fav_brand_id,
      data.profile_url || null,
      data.bio || null,
      data.social,
      data.visibility,
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
    const query = `INSERT INTO user_stats (user_id, sum, last_noti_read) VALUES (?, 0, CURRENT_TIMESTAMP)`;
    if (queryRunner) {
      await queryRunner.query(query, [userId]);
    } else {
      await this.mysql.execute(query, [userId]);
    }
  }

  async updateLastNotiRead(userId: string): Promise<void> {
    const query = `
      UPDATE user_stats 
      SET last_noti_read = CURRENT_TIMESTAMP 
      WHERE user_id = ?
    `;
    await this.mysql.execute(query, [userId]);
  }

  async findLastNotiRead(userId: string): Promise<Date | null> {
    const query = `SELECT last_noti_read FROM user_stats WHERE user_id = ?`;
    const results = await this.mysql.query<{ last_noti_read: Date }>(query, [
      userId,
    ]);
    return results[0]?.last_noti_read || null;
  }

  async findAuthUserByPublicId(
    publicId: string,
  ): Promise<Pick<UserRow, 'public_id' | 'nickname'> | null> {
    const query = `
      SELECT public_id, nickname 
      FROM user 
      WHERE public_id = ? AND deleted_at IS NULL
      LIMIT 1
    `;
    const results = await this.mysql.query<UserRow>(query, [publicId]);
    return results[0] || null;
  }

  async findByPublicId(publicId: string): Promise<UserRow | null> {
    const query = `
      SELECT 
        id, public_id, useremail, nickname, profile_url, 
        fav_brand_id, social, bio, visibility, created_at, updated_at, 
        deleted_at
      FROM user 
      WHERE public_id = ? AND deleted_at IS NULL
    `;
    const results = await this.mysql.query<UserRow>(query, [publicId]);
    return results[0] || null;
  }

  async findByEmailAndProvider(
    email: string,
    social: string,
  ): Promise<UserRow | null> {
    const query = `
      SELECT 
        id, public_id, useremail, nickname, profile_url, 
        fav_brand_id, social, bio, visibility, created_at, updated_at, 
        deleted_at
      FROM user 
      WHERE useremail = ? AND social = ? AND deleted_at IS NULL
    `;
    const results = await this.mysql.query<UserRow>(query, [email, social]);
    return results[0] || null;
  }

  async findUserWithStats(publicId: string): Promise<UserWithStatsRow | null> {
    const query = `
      SELECT 
        u.public_id, 
        u.nickname, 
        u.profile_url, 
        u.bio, 
        u.fav_brand_id,
        u.visibility,
        us.sum
      FROM user u
      LEFT JOIN user_stats us ON u.public_id = us.user_id
      WHERE u.public_id = ? AND u.deleted_at IS NULL
    `;
    const results = await this.mysql.query<UserWithStatsRow>(query, [publicId]);
    return results[0] || null;
  }

  async findUserFollowCounts(
    userId: string,
  ): Promise<{ follower: number; following: number } | null> {
    const query = `
      SELECT follower_count as follower, following_count as following
      FROM user_stats
      WHERE user_id = ?
    `;
    const results = await this.mysql.query<{
      follower: number;
      following: number;
    }>(query, [userId]);
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
