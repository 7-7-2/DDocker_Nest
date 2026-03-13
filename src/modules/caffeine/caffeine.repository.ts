import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { QueryRunner } from 'typeorm';
import { CaffeineMonthlyDetailRow } from './dto/caffeine-calendar.dto';

export interface CaffeineInsertData {
  user_id: string;
  brand_id: number;
  caffeine: number;
  size: string;
  shot: number;
  intensity: string;
  product_name: string;
}

@Injectable()
export class CaffeineRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async insertIntake(
    data: CaffeineInsertData,
    queryRunner?: QueryRunner,
  ): Promise<number> {
    const query = `
      INSERT INTO caffeine_intake (
        user_id, 
        brand_id, 
        caffeine, 
        size, 
        shot, 
        intensity, 
        product_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.user_id,
      data.brand_id,
      data.caffeine,
      data.size,
      data.shot,
      data.intensity,
      data.product_name,
    ];

    if (queryRunner) {
      const result: unknown = await queryRunner.query(query, params);
      if (this.mysql.isResultSetHeader(result)) {
        return result.insertId;
      }
      throw new InternalServerErrorException(
        'Insert failed: No ResultSetHeader',
      );
    }

    const header = await this.mysql.execute(query, params);
    return header.insertId;
  }

  async updateUserStatsSum(
    userId: string,
    addedCaffeine: number,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const query = `
      UPDATE user_stats 
      SET sum = sum + ? 
      WHERE user_id = ?
    `;
    const params = [addedCaffeine, userId];

    if (queryRunner) {
      await queryRunner.query(query, params);
    } else {
      await this.mysql.execute(query, params);
    }
  }

  async findMonthlyDetails(
    userId: string,
    start: string,
    end: string,
  ): Promise<CaffeineMonthlyDetailRow[]> {
    const query = `
      SELECT 
        DAY(i.created_at) as day,
        b.brand_name,
        i.caffeine,
        i.product_name,
        i.intensity,
        i.shot,
        i.size
      FROM caffeine_intake i
      JOIN brand b ON i.brand_id = b.id
      WHERE i.user_id = ? 
        AND i.created_at >= ? 
        AND i.created_at <= ?
        AND i.deleted_at IS NULL
      ORDER BY i.created_at ASC
    `;
    return await this.mysql.query<CaffeineMonthlyDetailRow>(query, [
      userId,
      start,
      end,
    ]);
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
