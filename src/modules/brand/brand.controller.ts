import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { BrandService } from './brand.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BrandMenuResponse } from './brand.repository';

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

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '브랜드 수정시 캐시 갱신' })
  async refreshCache() {
    await this.brandService.refreshCache();
    return { message: 'Brand cache refreshed' };
  }
}
