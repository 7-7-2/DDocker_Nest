import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BrandMenuResponse } from './brand.repository';
import { PopularProductDto } from './dto/popular-product.dto';

@ApiTags('Brand')
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: '전 브랜드 목록/메뉴 조회' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated JSON object of brands and menus',
  })
  async findAll(): Promise<BrandMenuResponse> {
    return await this.brandService.getBrandData();
  }

  @Get(':brandName/popular')
  @ApiOperation({ summary: '특정 브랜드의 인기 메뉴 Top 3 조회' })
  @ApiResponse({
    status: 200,
    type: [PopularProductDto],
    description: 'Array of top 3 popular products for the specified brand',
  })
  async getPopular(
    @Param('brandName') brandName: string,
  ): Promise<PopularProductDto[]> {
    return await this.brandService.getPopularProducts(brandName);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '브랜드 수정시 캐시 갱신' })
  async refreshCache() {
    await this.brandService.refreshCache();
    return { message: 'Brand cache refreshed' };
  }
}
