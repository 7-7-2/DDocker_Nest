import { Injectable } from '@nestjs/common';
import { MysqlService } from '../../providers/mysql/mysql.service';

export interface BrandMenuItem {
  brand: string;
  caffeine: number;
  menu: string;
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
              JSON_OBJECT('brand', b.brand_name, 'caffeine', p.caffeine, 'menu', p.name)
          ) AS brand_items
          FROM brand b
          INNER JOIN product p ON b.id = p.brand_id
          GROUP BY b.brand_name
      ) AS temp
    `;

    const results = await this.mysqlService.executeQuery<BrandQueryRow>(query);

    return results[0]?.coffee_menus;
  }
}
