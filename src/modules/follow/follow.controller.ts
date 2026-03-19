import {
  Controller,
  Post,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { FollowService } from './follow.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { PaginatedFollowResponseDto } from './dto/follow-list.dto';

@ApiTags('follow')
@Controller('follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'User followed successfully' })
  async follow(
    @GetUser('public_id') followerId: string,
    @GetUser('nickname') nickname: string,
    @Param('userId') followedId: string,
  ) {
    await this.followService.follow(followerId, nickname, followedId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'User unfollowed successfully' })
  async unfollow(
    @GetUser('public_id') followerId: string,
    @Param('userId') followedId: string,
  ) {
    await this.followService.unfollow(followerId, followedId);
    return { success: true };
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: 'Get followers of a user (Paginated)' })
  @ApiResponse({ status: 200, type: PaginatedFollowResponseDto })
  async getFollowers(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedFollowResponseDto> {
    const cursorId = cursor ? parseInt(cursor, 10) : null;
    return await this.followService.getFollowers(userId, cursorId);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: 'Get users a user is following (Paginated)' })
  @ApiResponse({ status: 200, type: PaginatedFollowResponseDto })
  async getFollowing(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedFollowResponseDto> {
    const cursorId = cursor ? parseInt(cursor, 10) : null;
    return await this.followService.getFollowing(userId, cursorId);
  }
}
