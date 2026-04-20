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

  async searchPosts(
    q: string,
    limit: number = 5,
    sort: 'likes' | 'recent' = 'likes',
    cursor?: string,
  ) {
    let decodedCursor:
      | { likes?: number; date?: string; id?: string }
      | undefined;

    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      if (sort === 'likes') {
        const [likes, id] = decoded.split('|');
        decodedCursor = { likes: Number(likes), id };
      } else {
        const [date, id] = decoded.split('|');
        decodedCursor = { date, id };
      }
    }

    const results = await this.searchRepository.searchPostsByDescription(
      q,
      limit,
      sort,
      decodedCursor,
    );

    const hasNext = results.length === limit;
    let nextCursor: string | null = null;

    if (hasNext) {
      const last = results[results.length - 1];
      if (sort === 'likes') {
        nextCursor = Buffer.from(`${last.likeCount}|${last.postId}`).toString(
          'base64',
        );
      } else {
        const dateStr = last.createdAt.toISOString();
        nextCursor = Buffer.from(`${dateStr}|${last.postId}`).toString(
          'base64',
        );
      }
    }

    return {
      results,
      nextCursor,
    };
  }
}
