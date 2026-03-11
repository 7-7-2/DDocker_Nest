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
        account_privacy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
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

  async findByPublicId(publicId: string): Promise<UserRow | null> {
    const query = `SELECT * FROM user WHERE public_id = ? AND deleted_at IS NULL`;
    const results = await this.mysql.query<UserRow>(query, [publicId]);
    return results[0] || null;
  }

  async findByEmailAndProvider(
    email: string,
    social: string,
  ): Promise<UserRow | null> {
    const query = `
      SELECT * FROM user 
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
        u.account_privacy,
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
      SELECT COUNT(*) as count 
      FROM user 
      WHERE nickname = ? AND deleted_at IS NULL
    `;
    const results = await this.mysql.query<{ count: string }>(query, [
      nickname,
    ]);
    const row = results[0];
    if (row) {
      return parseInt(row.count, 10) > 0;
    }
    return false;
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
