import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { PostService } from './post.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import {
  PostResponseDto,
  PaginatedPostResponseDto,
  SocialCountsResponseDto,
} from './dto/post-response.dto';
import { CreatePostDto } from './dto/create-post.dto';

@ApiTags('posts')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('register')
  @ApiOperation({ summary: 'Register a new post with caffeine intake' })
  @ApiResponse({ status: 201, description: 'Post registered successfully' })
  async registerPost(
    @GetUser('public_id') userId: string,
    @Body() dto: CreatePostDto,
  ): Promise<{ success: boolean }> {
    await this.postService.registerPost(userId, dto);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('following/:cursor')
  @ApiOperation({ summary: 'Get social feed from followed users (Paginated)' })
  @ApiResponse({ status: 200, type: PaginatedPostResponseDto })
  async getFollowingPosts(
    @GetUser('public_id') userId: string,
    @Param('cursor') cursor: string,
  ): Promise<PaginatedPostResponseDto> {
    const cursorStr = cursor === 'first' ? null : cursor;
    return await this.postService.getFollowingPosts(userId, cursorStr);
  }

  @Get(':postId/counts')
  @ApiOperation({
    summary: 'Get interaction counts (likes/comments) for a post',
  })
  @ApiResponse({ status: 200, type: SocialCountsResponseDto })
  async getPostSocialCounts(
    @Param('postId') postId: string,
  ): Promise<SocialCountsResponseDto> {
    return await this.postService.getStatsWithFallback(postId);
  }

  @Get(':postId')
  @ApiOperation({ summary: 'Get single post details' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  async getPostDetail(
    @Param('postId') postId: string,
  ): Promise<PostResponseDto> {
    return await this.postService.getPostDetail(postId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':postId')
  @ApiOperation({ summary: 'Delete a post and its caffeine intake' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  async deletePost(
    @GetUser('public_id') userId: string,
    @Param('postId') postId: string,
  ): Promise<{ success: boolean }> {
    await this.postService.deletePost(userId, postId);
    return { success: true };
  }
}
