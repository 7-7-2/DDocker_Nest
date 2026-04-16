export interface UserStatsRow {
  id: number;
  user_id: string;
  sum: number;
  post_count: number;
  following_count: number;
  follower_count: number;
  last_noti_read: Date;
}
