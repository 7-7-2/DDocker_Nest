import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LikeService } from './like.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('like')
@Controller('likes')
export class LikeController {
  constructor(private readonly likeService: LikeService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a post' })
  @ApiResponse({ status: 200, description: 'Post liked' })
  async likePost(
    @GetUser('public_id') userId: string,
    @GetUser('nickname') nickname: string,
    @Param('postId') postId: string,
  ) {
    await this.likeService.likePost(userId, nickname, postId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a post' })
  @ApiResponse({ status: 200, description: 'Post unliked' })
  async unlikePost(
    @GetUser('public_id') userId: string,
    @Param('postId') postId: string,
  ) {
    await this.likeService.unlikePost(userId, postId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':postId')
  @ApiOperation({ summary: 'Check if current user liked a post' })
  @ApiResponse({ status: 200, description: 'Returns boolean liked status' })
  async isLiked(
    @GetUser('public_id') userId: string,
    @Param('postId') postId: string,
  ): Promise<{ liked: boolean }> {
    const liked = await this.likeService.isLiked(userId, postId);
    return { liked };
  }
}
