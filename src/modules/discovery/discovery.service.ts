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
    let ranking = await this.discoveryRepository.findBrandRanking(true);
    if (ranking.length < 5) {
      ranking = await this.discoveryRepository.findBrandRanking(false);
    }
    return ranking;
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
