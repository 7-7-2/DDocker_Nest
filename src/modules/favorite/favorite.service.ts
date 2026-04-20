import { Injectable, BadRequestException } from '@nestjs/common';
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

    await this.favoriteRepository.insertFavorite(userId, {
      brandId: brandId,
      productName: dto.productName,
      caffeine: dto.caffeine,
      size: dto.size,
      shot: dto.shot ?? 0,
      intensity: dto.intensity ?? '기본',
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
