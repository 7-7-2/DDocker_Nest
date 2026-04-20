import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { FavoriteRepository } from './favorite.repository';
import {
  CreateFavoriteDto,
  FavoriteResponseDto,
  RemoveFavoriteDto,
} from './dto/favorite.dto';
import { FavoriteRow } from './entities/favorite.entity';
import { BrandService } from '../brand/brand.service';

@Injectable()
export class FavoriteService {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly brandService: BrandService,
  ) {}

  async addFavorite(userId: string, dto: CreateFavoriteDto): Promise<void> {
    const brandId = await this.brandService.resolveBrandId(dto.brand);
    if (!brandId) {
      throw new BadRequestException(`Invalid brand: ${dto.brand}`);
    }

    const size = dto.size;
    const shot = dto.shot ?? 0;
    const intensity = dto.intensity ?? '기본';

    const favorites = await this.favoriteRepository.findFavorites(
      userId,
      brandId,
      dto.productName,
    );

    const isDuplicate = favorites.some(
      (v: FavoriteRow) =>
        v.size === size && v.shot === shot && v.intensity === intensity,
    );

    if (isDuplicate) {
      throw new ConflictException(
        'This exact product configuration is already in your favorites',
      );
    }

    await this.favoriteRepository.insertFavorite(userId, {
      brandId: brandId,
      productName: dto.productName,
      caffeine: dto.caffeine,
      size,
      shot,
      intensity,
    });
  }

  async removeFavorite(userId: string, dto: RemoveFavoriteDto): Promise<void> {
    await this.favoriteRepository.deleteFavorite(userId, dto.id);
  }

  async getMyFavorites(userId: string): Promise<FavoriteResponseDto[]> {
    const rows = await this.favoriteRepository.findByUserId(userId);
    return Promise.all(rows.map((row) => this.mapToResponseDto(row)));
  }

  private async mapToResponseDto(
    row: FavoriteRow,
  ): Promise<FavoriteResponseDto> {
    const brandName = await this.brandService.resolveBrandName(row.brand_id);
    return {
      id: row.id,
      userId: row.user_id,
      brand: brandName || 'Unknown',
      productName: row.product_name,
      caffeine: row.caffeine,
      size: row.size,
      shot: row.shot,
      intensity: row.intensity,
    };
  }
}
