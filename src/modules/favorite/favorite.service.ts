import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { FavoriteRepository } from './favorite.repository';
import { CreateFavoriteDto, FavoriteResponseDto } from './dto/favorite.dto';
import { FavoriteRow } from './entities/favorite.entity';
import { BrandService } from '../brand/brand.service';

@Injectable()
export class FavoriteService {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly brandService: BrandService,
  ) {}

  async addFavorite(userId: string, dto: CreateFavoriteDto): Promise<void> {
    const brandId = await this.brandService.resolveBrandId(dto.brandId);
    if (!brandId) {
      throw new BadRequestException(`Invalid brand: ${dto.brandId}`);
    }

    const existing = await this.favoriteRepository.findOne(
      userId,
      dto.productName,
    );
    if (existing) {
      throw new ConflictException('Product already in favorites');
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

  async removeFavorite(userId: string, favoriteId: number): Promise<void> {
    await this.favoriteRepository.deleteFavorite(userId, favoriteId);
  }

  async getMyFavorites(userId: string): Promise<FavoriteResponseDto[]> {
    const rows = await this.favoriteRepository.findByUserId(userId);
    return rows.map((row) => this.mapToResponseDto(row));
  }

  private mapToResponseDto(row: FavoriteRow): FavoriteResponseDto {
    return {
      id: row.id,
      userId: row.user_id,
      brandId: row.brand_id,
      productName: row.product_name,
      caffeine: row.caffeine,
      size: row.size,
      shot: row.shot,
      intensity: row.intensity,
    };
  }
}
