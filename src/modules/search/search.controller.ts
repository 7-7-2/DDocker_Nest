import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: '유저 또는 포스트 탐색' })
  @ApiQuery({ name: 'q', description: 'Search term' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['user', 'post'],
    description: 'Search type (default: user)',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['likes', 'recent'],
    description: 'Sort order for posts (default: likes)',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Pagination cursor',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results (default: 5)',
  })
  async search(
    @Query('q') q: string,
    @Query('type') type: 'user' | 'post' = 'user',
    @Query('sort') sort: 'likes' | 'recent' = 'likes',
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 5,
  ) {
    if (type === 'post') {
      return await this.searchService.searchPosts(
        q,
        Number(limit),
        sort,
        cursor,
      );
    }

    // Default: User search
    let cursorNickname: string | undefined;
    let cursorId: string | undefined;

    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [decodedNickname, decodedId] = decoded.split(':');
      cursorNickname = decodedNickname;
      cursorId = decodedId;
    }

    return await this.searchService.searchUsers(
      q,
      Number(limit),
      cursorNickname,
      cursorId,
    );
  }
}
