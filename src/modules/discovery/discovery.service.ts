import { Injectable } from '@nestjs/common';
import { DiscoveryRepository } from './discovery.repository';
import {
  BrandRankingDto,
  FeedPostDto,
  BrandPopularMenuDto,
} from './dto/discovery-response.dto';

import { RedisService } from '../../providers/redis/redis.service';
import { BrandService } from '../brand/brand.service';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as advancedFormat from 'dayjs/plugin/advancedFormat';
import * as isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
dayjs.extend(isoWeek);

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discoveryRepository: DiscoveryRepository,
    private readonly redisService: RedisService,
    private readonly brandService: BrandService,
  ) {}

  async getBrandRanking(): Promise<BrandRankingDto[]> {
    const fakeKSTNow = dayjs.utc().add(9, 'hour');
    const weeklyKey = `brand:ranking:weekly:${fakeKSTNow.format('GGGG-WW')}`;
    const allKey = 'brand:ranking:all';

    const ranking = await this.redisService.zrevrangeWithScores(weeklyKey, 0, 4);
    const existingIds = new Set(ranking.map((r) => parseInt(r.value, 10)));

    if (ranking.length < 5) {
      const allTime = await this.redisService.zrevrangeWithScores(allKey, 0, 10);
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
        return {
          brandId,
          brandName,
          intakeCount: item.score,
        };
      }),
    );
  }

  async getDailyPopular(): Promise<FeedPostDto[]> {
    const cacheKey = 'discovery:popular:daily';
    return await this.redisService.getOrSet(cacheKey, 900, async () => {
      return await this.discoveryRepository.findDailyPopular();
    });
  }

  async getBrandRecentPosts(brandId: number): Promise<FeedPostDto[]> {
    const cacheKey = `discovery:brand:recent:${brandId}`;
    return await this.redisService.getOrSet(cacheKey, 120, async () => {
      return await this.discoveryRepository.findBrandRecentPosts(brandId);
    });
  }

  async getBrandPopularPosts(brandId: number): Promise<FeedPostDto[]> {
    const cacheKey = `discovery:brand:popular:${brandId}`;
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      return await this.discoveryRepository.findBrandPopularPosts(brandId);
    });
  }

  async getBrandPopularMenu(
    brandId: number,
  ): Promise<BrandPopularMenuDto | null> {
    const cacheKey = `discovery:brand:popular-menu:${brandId}`;
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const result =
        await this.discoveryRepository.findWeeklyPopularBrandMenu(brandId);
      return result || null;
    });
  }
}
