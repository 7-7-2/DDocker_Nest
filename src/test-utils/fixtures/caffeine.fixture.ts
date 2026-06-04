import { CaffeineIntakeRow } from '../../modules/caffeine/entities/caffeine-intake.entity';

export const createCaffeineIntakeFixture = (
  overrides?: Partial<CaffeineIntakeRow>,
): CaffeineIntakeRow => ({
  id: 1,
  user_id: 'test-user-uuid',
  brand_id: 1,
  caffeine: 150,
  size: 'Regular',
  shot: 0,
  intensity: '기본',
  product_name: 'Americano',
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
  ...overrides,
});
