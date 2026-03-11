import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { CaffeineIntakeRow } from './entities/caffeine-intake.entity';
import { QueryRunner } from 'typeorm';

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

  //TODO : MUST-Cache
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

  async findHistoryByUserId(userId: string): Promise<CaffeineIntakeRow[]> {
    const query = `
      SELECT * FROM caffeine_intake 
      WHERE user_id = ? AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return await this.mysql.query<CaffeineIntakeRow>(query, [userId]);
  }

  async getQueryRunner() {
    return this.mysql.getQueryRunner();
  }
}
