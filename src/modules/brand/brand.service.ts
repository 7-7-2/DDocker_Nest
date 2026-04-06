import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BrandRepository, BrandMenuResponse } from './brand.repository';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  private readonly BRAND_CACHE_KEY = 'brand_all_data';
  private readonly BRAND_MAP_KEY = 'brand_id_map';
  private readonly BRAND_NAME_MAP_KEY = 'brand_name_map';
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
      const maps = await this.refreshBrandMaps();
      brandMap = maps.idMap;
    }

    return brandMap[identifier] || brandMap[identifier.toLowerCase()] || null;
  }

  async resolveBrandName(id: string | number): Promise<string | null> {
    let nameMap = await this.cacheManager.get<Record<number, string>>(
      this.BRAND_NAME_MAP_KEY,
    );

    if (!nameMap) {
      const maps = await this.refreshBrandMaps();
      nameMap = maps.nameMap;
    }

    return (nameMap[id] as string) || null;
  }

  async refreshBrandMaps(): Promise<{
    idMap: Record<string, number>;
    nameMap: Record<number, string>;
  }> {
    this.logger.log('Refreshing brand name/id map caches...');
    const brands = await this.brandRepository.findAllBrands();
    const idMap: Record<string, number> = {};
    const nameMap: Record<number, string> = {};

    brands.forEach((b) => {
      idMap[b.brand_name] = b.id;
      idMap[b.brand_name.toLowerCase()] = b.id;
      nameMap[b.id] = b.brand_name;
    });

    await this.cacheManager.set(this.BRAND_MAP_KEY, idMap, this.CACHE_TTL);
    await this.cacheManager.set(
      this.BRAND_NAME_MAP_KEY,
      nameMap,
      this.CACHE_TTL,
    );
    return { idMap, nameMap };
  }

  async refreshBrandMap(): Promise<Record<string, number>> {
    const { idMap } = await this.refreshBrandMaps();
    return idMap;
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
