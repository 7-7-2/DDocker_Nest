import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BrandRepository, BrandMenuResponse } from './brand.repository';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  private readonly BRAND_CACHE_KEY = 'brand_all_data';
  private readonly BRAND_MAP_KEY = 'brand_id_map';
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly brandRepository: BrandRepository,
  ) {}

  async resolveBrandId(identifier: string | number): Promise<number | null> {
    if (typeof identifier === 'number') return identifier;
    const maybeId = parseInt(identifier, 10);
    if (!isNaN(maybeId)) return maybeId;

    let brandMap = await this.cacheManager.get<Record<string, number>>(
      this.BRAND_MAP_KEY,
    );

    if (!brandMap) {
      brandMap = await this.refreshBrandMap();
    }

    return brandMap[identifier] || brandMap[identifier.toLowerCase()] || null;
  }

  async refreshBrandMap(): Promise<Record<string, number>> {
    this.logger.log('Refreshing brand name-to-id map cache...');
    const brands = await this.brandRepository.findAllBrands();
    const map: Record<string, number> = {};

    brands.forEach((b) => {
      map[b.brand_name] = b.id;
      map[b.brand_name.toLowerCase()] = b.id;
    });

    await this.cacheManager.set(this.BRAND_MAP_KEY, map, this.CACHE_TTL);
    return map;
  }

  async getBrandData(): Promise<BrandMenuResponse> {
    const cachedData = await this.cacheManager.get<BrandMenuResponse>(
      this.BRAND_CACHE_KEY,
    );

    if (cachedData) {
      this.logger.debug('Returning brand data from cache.');
      return cachedData;
    }

    this.logger.log('Cache miss. Fetching aggregated brand data from DB.');
    const data = await this.brandRepository.getAggregatedBrandData();

    await this.cacheManager.set(this.BRAND_CACHE_KEY, data, this.CACHE_TTL);

    return data;
  }

  async refreshCache(): Promise<void> {
    this.logger.log('Manually refreshing brand cache...');
    const data = await this.brandRepository.getAggregatedBrandData();
    await this.cacheManager.set(this.BRAND_CACHE_KEY, data, this.CACHE_TTL);
  }
}
