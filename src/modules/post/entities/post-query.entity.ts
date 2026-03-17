import { PostRow } from './post.entity';

export interface PostDetailRow extends PostRow {
  nickname: string;
  profile_url: string | null;
  user_sum: number;
  // From caffeine_intake
  brand_id: number;
  caffeine: number;
  product_name: string;
  size: string;
  shot: number;
  intensity: string;
}

export interface PostFeedRow extends PostRow {
  nickname: string;
  profile_url: string | null;
  user_sum: number;
  like_count: number;
  comment_count: number;
  // From caffeine_intake
  brand_id: number;
  caffeine: number;
  product_name: string;
  size: string;
  shot: number;
  intensity: string;
}
