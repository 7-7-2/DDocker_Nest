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

@ApiTags('Posts')
@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('register')
  @ApiOperation({ summary: 'caffeine_intake 포함 포스트 동록' })
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
  @ApiOperation({ summary: '팔로잉 중인 유저들 포스트 조회(Paginated)' })
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
    summary: '게시글 좋아요/댓글 수 조회',
  })
  @ApiResponse({ status: 200, type: SocialCountsResponseDto })
  async getPostSocialCounts(
    @Param('postId') postId: string,
  ): Promise<SocialCountsResponseDto> {
    return await this.postService.getStatsWithFallback(postId);
  }

  @Get(':postId')
  @ApiOperation({ summary: '단일 게시글 상세 조회' })
  @ApiResponse({ status: 200, type: PostResponseDto })
  async getPostDetail(
    @Param('postId') postId: string,
  ): Promise<PostResponseDto> {
    return await this.postService.getPostDetail(postId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':postId')
  @ApiOperation({ summary: 'caffeine_intake 포함 게시글 삭제 (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Post deleted successfully' })
  async deletePost(
    @GetUser('public_id') userId: string,
    @Param('postId') postId: string,
  ): Promise<{ success: boolean }> {
    await this.postService.deletePost(userId, postId);
    return { success: true };
  }
}
