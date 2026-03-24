import { Injectable } from '@nestjs/common';
import { SearchRepository } from './search.repository';

@Injectable()
export class SearchService {
  constructor(private readonly searchRepository: SearchRepository) {}

  async searchUsers(
    nickname: string,
    limit: number = 5,
    cursorNickname?: string,
    cursorId?: string,
  ) {
    const results = await this.searchRepository.searchUsersByNickname(
      nickname,
      limit,
      cursorNickname,
      cursorId,
    );

    const hasNext = results.length === limit;
    let nextCursor: string | null = null;

    if (hasNext) {
      const last = results[results.length - 1];
      nextCursor = Buffer.from(`${last.nickname}:${last.userId}`).toString(
        'base64',
      );
    }

    return {
      results,
      nextCursor,
    };
  }
}
