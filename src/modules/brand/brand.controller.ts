import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { BrandService } from './brand.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BrandMenuResponse } from './brand.repository';

@ApiTags('brand')
@Controller('brand')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Get()
  @ApiOperation({ summary: 'Get all brand and menu data (Cached)' })
  @ApiResponse({
    status: 200,
    description: 'Aggregated JSON object of brands and menus',
  })
  async findAll(): Promise<BrandMenuResponse> {
    return await this.brandService.getBrandData();
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually refresh the brand cache' })
  async refreshCache() {
    await this.brandService.refreshCache();
    return { message: 'Brand cache refreshed' };
  }
}
