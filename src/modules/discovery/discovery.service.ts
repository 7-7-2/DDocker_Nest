import { Injectable } from '@nestjs/common';
import { DiscoveryRepository } from './discovery.repository';
import {
  BrandRankingDto,
  FeedPostDto,
  BrandPopularMenuDto,
} from './dto/discovery-response.dto';

import { RedisService } from '../../providers/redis/redis.service';
import { BrandService } from '../brand/brand.service';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import { DateUtil } from '../../common/utils/date.util';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discoveryRepository: DiscoveryRepository,
    private readonly redisService: RedisService,
    private readonly brandService: BrandService,
  ) {}

  async getBrandRanking(): Promise<BrandRankingDto[]> {
    const fakeKSTNow = DateUtil.nowKst();
    const weeklyKey = REDIS_KEYS.BRAND.RANKING_WEEKLY(
      fakeKSTNow.format('GGGG-WW'),
    );
    const allKey = REDIS_KEYS.BRAND.RANKING_ALL;

    const ranking = await this.redisService.zrevrangeWithScores(
      weeklyKey,
      0,
      4,
    );
    const existingIds = new Set(ranking.map((r) => parseInt(r.value, 10)));

    if (ranking.length < 5) {
      const allTime = await this.redisService.zrevrangeWithScores(
        allKey,
        0,
        10,
      );
      for (const item of allTime) {
        const id = parseInt(item.value, 10);
        if (!existingIds.has(id)) {
          ranking.push(item);
          existingIds.add(id);
          if (ranking.length >= 5) break;
        }
      }
    }

    if (ranking.length < 5) {
      const dbRanking = await this.discoveryRepository.findBrandRanking(false);
      for (const row of dbRanking) {
        if (!existingIds.has(row.brandId)) {
          ranking.push({
            value: row.brandId.toString(),
            score: row.intakeCount,
          });
          existingIds.add(row.brandId);
          if (ranking.length >= 5) break;
        }
      }
    }

    // Map to DTO
    return await Promise.all(
      ranking.map(async (item) => {
        const brandId = parseInt(item.value, 10);
        const brandName =
          (await this.brandService.resolveBrandName(brandId)) || 'Unknown';
        return BrandRankingDto.fromRow(item, brandName);
      }),
    );
  }

  async getDailyPopular(): Promise<FeedPostDto[]> {
    const cacheKey = REDIS_KEYS.DISCOVERY.DAILY_POPULAR;
    return await this.redisService.getOrSet(cacheKey, 900, async () => {
      const rows = await this.discoveryRepository.findDailyPopular();
      return rows.map((row) => FeedPostDto.fromRow(row));
    });
  }

  async getBrandRecentPosts(brandId: number): Promise<FeedPostDto[]> {
    const cacheKey = REDIS_KEYS.DISCOVERY.RECENT(brandId);
    return await this.redisService.getOrSet(cacheKey, 120, async () => {
      const rows = await this.discoveryRepository.findBrandRecentPosts(brandId);
      return rows.map((row) => FeedPostDto.fromRow(row));
    });
  }

  async getBrandPopularPosts(brandId: number): Promise<FeedPostDto[]> {
    const cacheKey = REDIS_KEYS.DISCOVERY.POPULAR(brandId);
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const rows = await this.discoveryRepository.findBrandPopularPosts(brandId);
      return rows.map((row) => FeedPostDto.fromRow(row));
    });
  }

  async getBrandPopularMenu(
    brandId: number,
  ): Promise<BrandPopularMenuDto | null> {
    const cacheKey = REDIS_KEYS.DISCOVERY.POPULAR_MENU(brandId);
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const row =
        await this.discoveryRepository.findWeeklyPopularBrandMenu(brandId);
      return row ? BrandPopularMenuDto.fromRow(row) : null;
    });
  }
}
