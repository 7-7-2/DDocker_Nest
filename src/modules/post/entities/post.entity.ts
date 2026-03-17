export interface PostRow {
  id: number;
  user_id: string;
  caffeine_intake_id: number;
  photo: string | null;
  public_id: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  visibility: number; // 0: Private, 1: Public, 2: Mutual
}

export interface PostStatsRow {
  post_id: string;
  like_count: number;
  comment_count: number;
}

export interface PostWithStatsRow extends PostRow {
  like_count: number;
  comment_count: number;
  nickname: string;
  profile_url: string | null;
}
