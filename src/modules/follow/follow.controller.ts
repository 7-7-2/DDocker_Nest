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

@ApiTags('Follow')
@Controller('follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '유저 팔로우' })
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
  @ApiOperation({ summary: '유저 언팔로우' })
  @ApiResponse({ status: 200, description: 'User unfollowed successfully' })
  async unfollow(
    @GetUser('public_id') followerId: string,
    @Param('userId') followedId: string,
  ) {
    await this.followService.unfollow(followerId, followedId);
    return { success: true };
  }

  @Get(':userId/followers')
  @ApiOperation({ summary: '유저 팔로워 조회 (Paginated)' })
  @ApiResponse({ status: 200, type: PaginatedFollowResponseDto })
  async getFollowers(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedFollowResponseDto> {
    const cursorId = cursor ? parseInt(cursor, 10) : null;
    return await this.followService.getFollowers(userId, cursorId);
  }

  @Get(':userId/following')
  @ApiOperation({ summary: '팔로잉 중 유저 조회 (Paginated)' })
  @ApiResponse({ status: 200, type: PaginatedFollowResponseDto })
  async getFollowing(
    @Param('userId') userId: string,
    @Query('cursor') cursor?: string,
  ): Promise<PaginatedFollowResponseDto> {
    const cursorId = cursor ? parseInt(cursor, 10) : null;
    return await this.followService.getFollowing(userId, cursorId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':userId')
  @ApiOperation({ summary: '팔로우 여부 확인' })
  @ApiResponse({
    status: 200,
    description: 'Returns 1 if following, 0 otherwise',
  })
  async checkFollowing(
    @GetUser('public_id') followerId: string,
    @Param('userId') followedId: string,
  ) {
    const isFollowing = await this.followService.isFollowing(
      followerId,
      followedId,
    );
    return isFollowing ? 1 : 0;
  }

  @Get(':userId/username')
  @ApiOperation({ summary: '유저 닉네임 조회' })
  @ApiResponse({
    status: 200,
    description: 'Returns the nickname of the user',
  })
  async getUsernameById(@Param('userId') userId: string) {
    return await this.followService.getUsernameById(userId);
  }
}
