import { Injectable } from '@nestjs/common';
import { DiscoveryRepository } from './discovery.repository';
import {
  BrandRankingDto,
  PopularPostDto,
  BrandPopularMenuDto,
} from './dto/discovery-response.dto';

@Injectable()
export class DiscoveryService {
  constructor(private readonly discoveryRepository: DiscoveryRepository) {}

  async getBrandRanking(): Promise<BrandRankingDto[]> {
    const weeklyRanking = await this.discoveryRepository.findBrandRanking(true);
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
  }

  async getDailyPopular(): Promise<PopularPostDto[]> {
    return await this.discoveryRepository.findDailyPopular();
  }

  async getBrandRecentPosts(brandId: number): Promise<PopularPostDto[]> {
    return await this.discoveryRepository.findBrandRecentPosts(brandId);
  }

  async getBrandPopularPosts(brandId: number): Promise<PopularPostDto[]> {
    return await this.discoveryRepository.findBrandPopularPosts(brandId);
  }

  async getBrandPopularMenu(
    brandId: number,
  ): Promise<BrandPopularMenuDto | null> {
    const result =
      await this.discoveryRepository.findWeeklyPopularBrandMenu(brandId);
    return result || null;
  }
}
