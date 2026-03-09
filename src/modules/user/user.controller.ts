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
import { UserRow } from './entities/user.entity';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new user after OAuth' })
  @ApiResponse({ status: 201, description: 'User successfully initialized' })
  async setUserInit(@Body() createUserDto: CreateUserDto) {
    return await this.userService.setUserInit(createUserDto);
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if a nickname is already taken' })
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
  @ApiOperation({ summary: 'Get current logged-in user profile info' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getMyInfo(@GetUser() user: UserRow) {
    return await this.userService.getUserInfo(user.public_id);
  }

  @Get(':userId/userInfo')
  @ApiOperation({ summary: 'Get another user profile info' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async getUserInfo(@Param('userId') userId: string) {
    return await this.userService.getUserInfo(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('userInfo')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  async editProfile(
    @GetUser() user: UserRow,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return await this.userService.patchUserProfile(
      user.public_id,
      updateUserDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':social')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Account soft-deleted' })
  async deleteAccount(@GetUser() user: UserRow) {
    return await this.userService.deleteAccount(user.public_id);
  }
}
