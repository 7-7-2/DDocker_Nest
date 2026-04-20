import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service';
import { PostService } from '../post/post.service';
import { UserProfilePostsResponseDto } from './dto/user-profile-posts.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly postService: PostService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'OAuth 이후 새 유저 등록' })
  @ApiResponse({ status: 201, description: 'User successfully initialized' })
  async setUserInit(@Body() createUserDto: CreateUserDto) {
    return await this.userService.setUserInit(createUserDto);
  }

  @Get('check')
  @ApiOperation({ summary: '닉네임 존재여부 확인' })
  @ApiResponse({
    status: 200,
    description: 'Returns true if nickname exists, false otherwise',
  })
  async checkUserNickname(@Query('nickname') nickname: string) {
    return await this.userService.checkUserNickname(nickname);
  }

  @UseGuards(JwtAuthGuard)
  @Get('userInfo')
  @ApiBearerAuth()
  @ApiOperation({ summary: '본인 정보 확인' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getMyInfo(@GetUser('public_id') userId: string) {
    return await this.userService.getUserInfo(userId);
  }

  @Get(':userId/userInfo')
  @ApiOperation({ summary: '유저 정보 확인(본인 제외)' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getUserInfo(@Param('userId') userId: string) {
    return await this.userService.getUserInfo(userId);
  }

  @Get(':userId/follow')
  @ApiOperation({ summary: '유저 팔로우 수 조회' })
  @ApiResponse({
    status: 200,
    description: 'Returns follower and following counts',
  })
  async getFollowCounts(@Param('userId') userId: string) {
    return await this.userService.getUserFollowCounts(userId);
  }

  @Get(':userId/posts/count')
  @ApiOperation({ summary: '유저별 포스트 수 조회' })
  @ApiResponse({ status: 200, description: 'Returns post count' })
  async getPostCount(@Param('userId') userId: string) {
    return await this.postService.getUserPostCount(userId);
  }

  @Get(':userId/posts')
  @ApiOperation({
    summary: '유저별 프로필 포스트 조회 (Grid/List, Cursor-based)',
  })
  @ApiResponse({ status: 200, type: UserProfilePostsResponseDto })
  async getUserPosts(
    @Param('userId') userId: string,
    @Query('type') type: 'grid' | 'list',
    @Query('cursor') cursor?: string,
  ): Promise<UserProfilePostsResponseDto> {
    return await this.postService.getUserPosts(userId, type, cursor);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('userInfo')
  @ApiBearerAuth()
  @ApiOperation({ summary: '본인 정보 업데이트' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async editProfile(
    @GetUser('public_id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.patchUserProfile(userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':social')
  @ApiBearerAuth()
  @ApiOperation({ summary: '회원 탈퇴 (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Account soft-deleted' })
  async deleteAccount(
    @GetUser('public_id') userId: string,
    @Param('social') social: string,
    @Query('code') code: string,
  ) {
    return await this.userService.deleteAccount(userId);
  }
}
