import { Injectable } from '@nestjs/common';
import { DiscoveryRepository } from './discovery.repository';
import {
  BrandRankingDto,
  FeedPostDto,
  BrandPopularMenuDto,
} from './dto/discovery-response.dto';

import { RedisService } from '../../providers/redis/redis.service';

@Injectable()
export class DiscoveryService {
  constructor(
    private readonly discoveryRepository: DiscoveryRepository,
    private readonly redisService: RedisService,
  ) {}

  async getBrandRanking(): Promise<BrandRankingDto[]> {
    const cacheKey = 'discovery:ranking';
    return await this.redisService.getOrSet(cacheKey, 3600, async () => {
      const weeklyRanking =
        await this.discoveryRepository.findBrandRanking(true);
      if (weeklyRanking.length >= 5) {
        return weeklyRanking;
      }

      const allTimeRanking =
        await this.discoveryRepository.findBrandRanking(false);
      const weeklyBrandIds = new Set(weeklyRanking.map((r) => r.brandId));

      const additionalRanking = allTimeRanking.filter(
        (r) => !weeklyBrandIds.has(r.brandId),
      );

      return [...weeklyRanking, ...additionalRanking].slice(0, 5);
    });
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
