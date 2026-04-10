import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';
import { BrandService } from '../brand/brand.service';
import {
  BrandRankingDto,
  FeedPostDto,
  BrandPopularMenuDto,
} from './dto/discovery-response.dto';

@ApiTags('Discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly brandService: BrandService,
  ) {}

  @Get('ranking')
  @ApiOperation({ summary: '주간/누적 브랜드 랭킹 조회(메인 하단)' })
  @ApiResponse({ status: 200, type: [BrandRankingDto] })
  async getBrandRanking(): Promise<BrandRankingDto[]> {
    return await this.discoveryService.getBrandRanking();
  }

  @Get('popular')
  @ApiOperation({ summary: '오늘의 인기 게시글 조회(피드 상단)' })
  @ApiResponse({ status: 200, type: [FeedPostDto] })
  async getDailyPopular(): Promise<FeedPostDto[]> {
    return await this.discoveryService.getDailyPopular();
  }

  @Get('brands/:brandId/recent')
  @ApiOperation({ summary: '특정 브랜드의 최근 게시글 조회' })
  @ApiResponse({ status: 200, type: [FeedPostDto] })
  async getBrandRecentPosts(
    @Param('brandId') brandIdentifier: string,
  ): Promise<FeedPostDto[]> {
    const brandId = await this.brandService.resolveBrandId(brandIdentifier);
    if (!brandId) throw new BadRequestException('Invalid brand identifier');
    return await this.discoveryService.getBrandRecentPosts(brandId);
  }

  @Get('brands/:brandId/popular')
  @ApiOperation({ summary: '특정 브랜드의 인기 게시글 조회' })
  @ApiResponse({ status: 200, type: [FeedPostDto] })
  async getBrandPopularPosts(
    @Param('brandId') brandIdentifier: string,
  ): Promise<FeedPostDto[]> {
    const brandId = await this.brandService.resolveBrandId(brandIdentifier);
    if (!brandId) throw new BadRequestException('Invalid brand identifier');
    return await this.discoveryService.getBrandPopularPosts(brandId);
  }

  @Get('brands/:brandId/popular-menu')
  @ApiOperation({ summary: '특정 브랜드의 주간 인기 메뉴 조회' })
  @ApiResponse({ status: 200, type: BrandPopularMenuDto })
  async getBrandPopularMenu(
    @Param('brandId') brandIdentifier: string,
  ): Promise<BrandPopularMenuDto | null> {
    const brandId = await this.brandService.resolveBrandId(brandIdentifier);
    if (!brandId) throw new BadRequestException('Invalid brand identifier');
    return await this.discoveryService.getBrandPopularMenu(brandId);
  }
}
