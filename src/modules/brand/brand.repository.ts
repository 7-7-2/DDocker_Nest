import { Injectable } from '@nestjs/common';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { BrandRow } from './entities/brand.entity';

export interface BrandMenuItem {
  brand: string;
  caffeine: number;
  menu: string;
  type: string;
}

export type BrandMenuResponse = Record<string, BrandMenuItem[]>;

interface BrandQueryRow {
  coffee_menus: BrandMenuResponse;
}

@Injectable()
export class BrandRepository {
  constructor(private readonly mysqlService: MysqlService) {}

  async getAggregatedBrandData(): Promise<BrandMenuResponse> {
    const query = `
      SELECT JSON_OBJECTAGG(brand_name, brand_items) AS coffee_menus
      FROM (
          SELECT b.brand_name, JSON_ARRAYAGG(
              JSON_OBJECT('brand', b.brand_name, 'caffeine', p.caffeine, 'menu', p.name, 'type', p.type)
          ) AS brand_items
          FROM brand b
          INNER JOIN product p ON b.id = p.brand_id
          GROUP BY b.brand_name
      ) AS temp
    `;

    const results = await this.mysqlService.query<BrandQueryRow>(query);

    return results[0]?.coffee_menus;
  }

  async findAllBrands(): Promise<BrandRow[]> {
    const query = 'SELECT id, brand_name FROM brand';
    return await this.mysqlService.query<BrandRow>(query);
  }

  async findRankedProducts(
    brandId: number,
    limit: number = 3,
  ): Promise<{ productName: string; caffeine: number }[]> {
    const query = `
      SELECT 
        p.name as productName, 
        p.caffeine
      FROM caffeine_intake i
      INNER JOIN product p ON i.brand_id = p.brand_id AND i.product_name = p.name
      WHERE i.brand_id = ? 
        AND i.deleted_at IS NULL
        AND i.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY p.name, p.caffeine
      ORDER BY COUNT(i.id) DESC, p.caffeine DESC
      LIMIT ?
    `;

    return await this.mysqlService.query(query, [brandId, limit]);
  }

  async findComparisonList(
    type: string,
  ): Promise<{ brandName: string; productName: string; caffeine: number }[]> {
    const query = `
      SELECT 
        b.brand_name as brandName,
        p.name as productName,
        p.caffeine
      FROM product p
      INNER JOIN brand b ON p.brand_id = b.id
      WHERE p.type = ?
    `;

    return await this.mysqlService.query(query, [type]);
  }
}
