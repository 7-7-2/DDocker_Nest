import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { FavoriteRow } from './entities/favorite.entity';

@Injectable()
export class FavoriteRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async insertFavorite(
    userId: string,
    data: {
      brandId: number;
      productName: string;
      caffeine: number;
      size: string;
      shot: number;
      intensity: string;
    },
  ): Promise<void> {
    const query = `
      INSERT INTO favourites (user_id, brand_id, product_name, caffeine, size, shot, intensity) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.mysql.execute(query, [
      userId,
      data.brandId,
      data.productName,
      data.caffeine,
      data.size,
      data.shot,
      data.intensity,
    ]);
  }

  async deleteFavorite(
    userId: string,
    brandId: number,
    productName: string,
  ): Promise<void> {
    const query = `
      DELETE FROM favourites 
      WHERE user_id = ? AND brand_id = ? AND product_name = ?
    `;
    await this.mysql.execute(query, [userId, brandId, productName]);
  }

  async findByUserId(userId: string): Promise<FavoriteRow[]> {
    const query = `
      SELECT id, user_id, brand_id, product_name, caffeine, size, shot, intensity 
      FROM favourites 
      WHERE user_id = ?
      ORDER BY id DESC
    `;
    return await this.mysql.query<FavoriteRow>(query, [userId]);
  }

  async findOne(
    userId: string,
    brandId: number,
    productName: string,
  ): Promise<FavoriteRow | null> {
    const query = `
      SELECT id, user_id, brand_id, product_name, caffeine, size, shot, intensity 
      FROM favourites 
      WHERE user_id = ? AND brand_id = ? AND product_name = ?
      LIMIT 1
    `;
    const results = await this.mysql.query<FavoriteRow>(query, [
      userId,
      brandId,
      productName,
    ]);
    return results[0] || null;
  }
}
