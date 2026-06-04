import { PostRow, PostStatsRow } from '../../modules/post/entities/post.entity';
import {
  PostDetailRow,
  PostFeedRow,
} from '../../modules/post/entities/post-query.entity';

export const createPostRowFixture = (
  overrides?: Partial<PostRow>,
): PostRow => ({
  id: 1,
  user_id: 'test-user-uuid',
  caffeine_intake_id: 1,
  photo: 'http://img.com/post.jpg',
  public_id: 'post-123',
  description: 'Nice coffee',
  visibility: 1,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});

export const createPostDetailRowFixture = (
  overrides?: Partial<PostDetailRow>,
): PostDetailRow => ({
  ...createPostRowFixture(),
  nickname: 'TestUser',
  profile_url: 'http://img.com/profile.jpg',
  user_sum: 500,
  brand_id: 1,
  caffeine: 150,
  product_name: 'Americano',
  size: 'Regular',
  shot: 0,
  intensity: '기본',
  ...overrides,
});

export const createPostStatsRowFixture = (
  overrides?: Partial<PostStatsRow>,
): PostStatsRow => ({
  post_id: 'post-123',
  like_count: 0,
  comment_count: 0,
  ...overrides,
});
