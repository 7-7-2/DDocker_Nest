export const REDIS_KEYS = {
  POST: {
    DETAIL: (postId: string) => `post:detail:${postId}`,
    STATS: (postId: string) => `post:stats:${postId}`,
    COMMENTS: (postId: string) => `post:comments:${postId}`,
    FEED: (userId: string) => `post:feed:following:${userId}`,
    LIKES: (postId: string) => `post:likes:${postId}`,
  },
  COMMENT: {
    REPLIES: (commentId: number) => `comment:replies:${commentId}`,
  },
  USER: {
    PROFILE: (userId: string) => `user:profile:${userId}`,
    STATS: (userId: string) => `user:stats:${userId}`,
    POSTS: (userId: string, type: string) =>
      `user:posts:${userId}:${type}:page1`,
  },
  CAFFEINE: {
    TODAY: (userId: string) => `caffeine:today:${userId}`,
    MONTHLY: (userId: string, monthKey: string) =>
      `caffeine:monthly:${userId}:${monthKey}`,
    ANALYSIS: (userId: string, unit: string, dayKey: string) =>
      `caffeine:analysis:${userId}:${unit}:${dayKey}`,
  },
  FOLLOW: {
    SET: (userId: string) => `follow:set:${userId}`,
    LIST: (userId: string, type: 'followers' | 'following') =>
      `follow:list:${type}:${userId}:page1`,
  },
  BRAND: {
    POPULAR: (brandId: number) => `brand:popular:${brandId}`,
    RANKING_WEEKLY: (weekKey: string) => `brand:ranking:weekly:${weekKey}`,
    RANKING_ALL: 'brand:ranking:all',
    COMPARISON: (type: string) => `comparison:list:${type}`,
    ALL_DATA: 'brand_all_data',
    ID_MAP: 'brand_id_map',
    NAME_MAP: 'brand_name_map',
    PRODUCT_TYPE_MAP: 'product_type_map',
  },
  DISCOVERY: {
    DAILY_POPULAR: 'discovery:popular:daily',
    RECENT: (brandId: number) => `discovery:brand:recent:${brandId}`,
    POPULAR: (brandId: number) => `discovery:brand:popular:${brandId}`,
    POPULAR_MENU: (brandId: number) =>
      `discovery:brand:popular-menu:${brandId}`,
  },
};
