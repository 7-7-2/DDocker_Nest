import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: '닉네임으로 유저 탐색' })
  @ApiQuery({ name: 'q', description: 'Nickname search term' })
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
  async searchUsers(
    @Query('q') nickname: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 5,
  ) {
    let cursorNickname: string | undefined;
    let cursorId: string | undefined;

    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [decodedNickname, decodedId] = decoded.split(':');
      cursorNickname = decodedNickname;
      cursorId = decodedId;
    }

    return await this.searchService.searchUsers(
      nickname,
      Number(limit),
      cursorNickname,
      cursorId,
    );
  }
}
