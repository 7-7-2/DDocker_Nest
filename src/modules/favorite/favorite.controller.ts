import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { FavoriteService } from './favorite.service';
import { CreateFavoriteDto, FavoriteResponseDto } from './dto/favorite.dto';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('favorite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a product to favorites' })
  @ApiResponse({ status: 201, description: 'Product added to favorites' })
  async addFavorite(
    @GetUser('public_id') userId: string,
    @Body() dto: CreateFavoriteDto,
  ) {
    await this.favoriteService.addFavorite(userId, dto);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a product from favorites' })
  @ApiResponse({ status: 200, description: 'Product removed from favorites' })
  async removeFavorite(
    @GetUser('public_id') userId: string,
    @Param('id', ParseIntPipe) favoriteId: number,
  ) {
    await this.favoriteService.removeFavorite(userId, favoriteId);
    return { success: true };
  }

  @Get()
  @ApiOperation({ summary: 'Get current user favorites' })
  @ApiResponse({ status: 200, type: [FavoriteResponseDto] })
  async getMyFavorites(
    @GetUser('public_id') userId: string,
  ): Promise<FavoriteResponseDto[]> {
    return await this.favoriteService.getMyFavorites(userId);
  }
}
