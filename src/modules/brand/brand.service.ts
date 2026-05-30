import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BrandRepository, BrandMenuResponse } from './brand.repository';
import { RedisService } from '../../providers/redis/redis.service';
import { PopularProductDto } from './dto/popular-product.dto';
import {
  ComparisonResponseDto,
  ComparisonItemDto,
} from './dto/comparison-response.dto';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);
  private readonly BRAND_CACHE_KEY = 'brand_all_data';
  private readonly BRAND_MAP_KEY = 'brand_id_map';
  private readonly BRAND_NAME_MAP_KEY = 'brand_name_map';
  private readonly PRODUCT_TYPE_MAP_KEY = 'product_type_map';
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly brandRepository: BrandRepository,
    private readonly redisService: RedisService,
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

    await this.getBrandData();

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

    const productTypeMap: Record<string, { type: string; caffeine: number }> =
      {};
    Object.values(data).forEach((menuItems) => {
      menuItems.forEach((item) => {
        const key = `${item.brand}:${item.menu}`;
        productTypeMap[key] = { type: item.type, caffeine: item.caffeine };
      });
    });
    await this.cacheManager.set(
      this.PRODUCT_TYPE_MAP_KEY,
      productTypeMap,
      this.CACHE_TTL,
    );

    return data;
  }

  async refreshCache(): Promise<void> {
    this.logger.log('Manually refreshing brand cache...');
    const data = await this.brandRepository.getAggregatedBrandData();
    await this.cacheManager.set(this.BRAND_CACHE_KEY, data, this.CACHE_TTL);

    await this.redisService.delByPattern('comparison:list:*');
  }

  async fetchCaffeineComparison(
    brandName: string,
    productName: string,
  ): Promise<ComparisonResponseDto> {
    try {
      const productTypeMap = await this.cacheManager.get<
        Record<string, { type: string; caffeine: number }>
      >(this.PRODUCT_TYPE_MAP_KEY);

      if (!productTypeMap) {
        await this.getBrandData();
        return this.fetchCaffeineComparison(brandName, productName);
      }

      const key = `${brandName}:${productName}`;
      const source = productTypeMap[key];

      if (!source || source.type === 'extra' || source.type === null) {
        throw new BadRequestException(
          `Comparison not available for this product: ${productName}`,
        );
      }

      const cacheKey = `comparison:list:${source.type}`;
      const TTL_30D = 2592000;

      const allMatches = await this.redisService.getOrSet(
        cacheKey,
        TTL_30D,
        async () => {
          this.logger.log(
            `Rebuilding absolute comparison list for type: ${source.type}`,
          );
          return await this.brandRepository.findComparisonList(source.type);
        },
      );

      const comparisons: ComparisonItemDto[] = allMatches
        .filter((item) => item.brandName !== brandName)
        .map((item) => ({
          brandName: item.brandName,
          productName: item.productName,
          caffeine: item.caffeine,
          diff: item.caffeine - source.caffeine,
        }));

      return {
        sourceType: source.type,
        baseCaffeine: source.caffeine,
        comparisons,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Failed to fetch comparison for ${brandName} - ${productName}`,
        error,
      );
      throw error;
    }
  }

  async getPopularProducts(
    brandIdentifier: string,
  ): Promise<PopularProductDto[]> {
    try {
      const brandId = await this.resolveBrandId(brandIdentifier);
      if (!brandId) return [];

      const cacheKey = `brand:popular:${brandId}`;
      const TTL_24H = 86400;

      return await this.redisService.getOrSet(cacheKey, TTL_24H, async () => {
        this.logger.log(
          `Fetching ranked products for brand ${brandId} from DB`,
        );
        return await this.brandRepository.findRankedProducts(brandId, 3);
      });
    } catch (error) {
      this.logger.error(
        `Failed to fetch popular products for brand: ${brandIdentifier}`,
        error,
      );
      return [];
    }
  }
}
