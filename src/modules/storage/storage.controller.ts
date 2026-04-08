import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('upload/:dir/:userId')
  @ApiOperation({ summary: 'R2 Presigned Upload URL 생성' })
  async getUploadUrl(
    @GetUser('public_id') loggedInUserId: string,
    @Param('dir') dir: string,
    @Param('userId') userId: string,
    @Query('postId') postId?: string,
  ): Promise<{ url: string }> {
    return await this.storageService.getUploadUrl(
      loggedInUserId,
      dir,
      userId,
      postId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('delete/:dir/:userId')
  @ApiOperation({ summary: 'R2 Presigned Delete URL 생성' })
  async getDeleteUrl(
    @GetUser('public_id') loggedInUserId: string,
    @Param('dir') dir: string,
    @Param('userId') userId: string,
    @Query('postId') postId?: string,
  ): Promise<{ url: string }> {
    return await this.storageService.getDeleteUrl(
      loggedInUserId,
      dir,
      userId,
      postId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('folder/:dir/:userId')
  @ApiOperation({ summary: 'R2 폴더 내 모든 아이템 삭제' })
  async deleteFolder(
    @GetUser('public_id') loggedInUserId: string,
    @Param('dir') dir: string,
    @Param('userId') userId: string,
  ): Promise<{ success: boolean }> {
    return await this.storageService.deleteFolder(loggedInUserId, dir, userId);
  }
}
