/**
 * Raw database row for follows table.
 * Matches SQL schema exactly (snake_case).
 */
export interface FollowRow {
  id: number;
  following_user_id: string;
  followed_user_id: string;
}
