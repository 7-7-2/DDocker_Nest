import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/database/base.repository';
import { MysqlService } from '../../providers/mysql/mysql.service';

export interface BrandRankingRow {
  brandId: number;
  brandName: string;
  intakeCount: number;
}

export interface PopularPostRow {
  postId: string;
  photo: string;
  productName?: string;
  brandId?: number;
  brandName?: string;
  caffeine?: number;
  shot?: number;
  likeCount: number;
  commentCount?: number;
  description?: string;
  nickname?: string;
  profileUrl?: string;
  createdAt?: Date;
  userId?: string;
}

export interface BrandPopularMenuRow {
  brandId: number;
  productName: string;
  orderCount: number;
}

@Injectable()
export class DiscoveryRepository extends BaseRepository {
  constructor(mysql: MysqlService) {
    super(mysql);
  }

  async findBrandRanking(
    weeklyOnly: boolean = true,
  ): Promise<BrandRankingRow[]> {
    const query = `
      SELECT 
        b.id as brandId, 
        b.brand_name as brandName, 
        COUNT(i.id) as intakeCount
      FROM caffeine_intake i
      INNER JOIN brand b ON i.brand_id = b.id
      INNER JOIN user u ON i.user_id = u.public_id
      WHERE i.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND u.visibility = 1
        ${weeklyOnly ? 'AND i.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)' : ''}
      GROUP BY b.id, b.brand_name
      ORDER BY intakeCount DESC
      LIMIT 5
    `;
    return await this.mysql.query<BrandRankingRow>(query);
  }

  async findDailyPopular(): Promise<PopularPostRow[]> {
    const query = `
      SELECT 
        p.public_id as postId,
        p.photo,
        ps.like_count as likeCount,
        ps.comment_count as commentCount,
        p.description,
        p.created_at as createdAt,
        u.profile_url as profileUrl,
        u.nickname,
        u.public_id as userId
      FROM post p
      INNER JOIN user u ON p.user_id = u.public_id
      INNER JOIN post_stats ps ON p.public_id = ps.post_id
      WHERE p.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND p.visibility = 1
        AND u.visibility = 1
        AND DATE(p.created_at) = CURDATE()
      ORDER BY ps.like_count DESC
      LIMIT 8
    `;
    return await this.mysql.query<PopularPostRow>(query);
  }

  async findBrandRecentPosts(brandId: number): Promise<PopularPostRow[]> {
    const query = `
      SELECT 
        p.public_id as postId,
        p.photo,
        i.product_name as productName,
        i.brand_id as brandId,
        b.brand_name as brandName,
        i.caffeine,
        i.shot,
        i.intensity,
        i.size,
        ps.like_count as likeCount,
        u.nickname,
        us.sum as userSum, 
        u.public_id userId,
        u.profile_url as profileUrl,
        p.created_at as createdAt
      FROM post p
      INNER JOIN user u ON p.user_id = u.public_id
      INNER JOIN caffeine_intake i ON p.caffeine_intake_id = i.id
      INNER JOIN brand b ON i.brand_id = b.id
      INNER JOIN post_stats ps ON p.public_id = ps.post_id
      INNER JOIN user_stats us ON p.user_id = us.user_id 
      WHERE p.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND p.visibility = 1
        AND u.visibility = 1
        AND i.brand_id = ?
      ORDER BY p.created_at DESC
      LIMIT 8
    `;
    return await this.mysql.query<PopularPostRow>(query, [brandId]);
  }

  async findBrandPopularPosts(brandId: number): Promise<PopularPostRow[]> {
    const query = `
      SELECT 
        p.public_id as postId,
        p.photo,
        i.product_name as productName,
        i.brand_id as brandId,
        b.brand_name as brandName,
        i.caffeine,
        i.shot,
        i.intensity,
        i.size,
        ps.like_count as likeCount,
        u.nickname,
        u.public_id as userId,
        u.profile_url as profileUrl,
        us.sum as userSum, 
        p.created_at as createdAt
      FROM post p
      INNER JOIN user u ON p.user_id = u.public_id
      INNER JOIN caffeine_intake i ON p.caffeine_intake_id = i.id
      INNER JOIN brand b ON i.brand_id = b.id
      INNER JOIN post_stats ps ON p.public_id = ps.post_id
      INNER JOIN user_stats us ON p.user_id = us.user_id 
      WHERE p.deleted_at IS NULL
        AND u.deleted_at IS NULL
        AND p.visibility = 1
        AND u.visibility = 1
        AND i.brand_id = ?
      ORDER BY ps.like_count DESC
      LIMIT 8
    `;
    return await this.mysql.query<PopularPostRow>(query, [brandId]);
  }

  async findWeeklyPopularBrandMenu(
    brandId: number,
  ): Promise<BrandPopularMenuRow | undefined> {
    const query = `
      SELECT 
        i.brand_id as brandId,
        i.product_name as productName,
        COUNT(*) as orderCount
      FROM caffeine_intake i
      WHERE i.brand_id = ?
        AND i.deleted_at IS NULL
        AND i.created_at >= DATE_SUB(NOW(), INTERVAL 1 WEEK)
      GROUP BY i.brand_id, i.product_name
      ORDER BY orderCount DESC
      LIMIT 1
    `;
    const results = await this.mysql.query<BrandPopularMenuRow>(query, [
      brandId,
    ]);
    return results[0];
  }
}
