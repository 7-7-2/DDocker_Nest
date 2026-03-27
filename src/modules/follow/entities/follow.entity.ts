export interface FollowRow {
  id: number;
  following_user_id: string;
  followed_user_id: string;
  is_mutual: number;
  created_at: Date;
}
