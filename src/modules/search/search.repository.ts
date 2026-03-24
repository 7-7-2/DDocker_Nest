import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';

export interface UserSearchRow {
  userId: string;
  nickname: string;
  url: string;
  caffeine: number;
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
      cursorCondition = `AND (u.nickname > ? OR (u.nickname = ? AND u.public_id > ?))`;
      params.push(cursorNickname, cursorNickname, cursorId);
    }

    const query = `
      SELECT 
        u.public_id as userId, 
        u.nickname, 
        u.profile_url as url, 
        s.sum as caffeine
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
}
