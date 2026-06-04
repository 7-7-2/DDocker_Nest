import { UserRow } from '../../modules/user/entities/user.entity';

export const createUserRowFixture = (
  overrides?: Partial<UserRow>,
): UserRow => ({
  id: 1,
  public_id: 'test-user-uuid',
  useremail: 'test@example.com',
  nickname: 'TestUser',
  profile_url: 'http://test.com/profile.jpg',
  fav_brand_id: 1,
  social: 'google',
  bio: 'Hello world',
  visibility: 1,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});
