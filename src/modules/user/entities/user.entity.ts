export interface UserRow {
  id: number;
  public_id: string;
  useremail: string;
  nickname: string | null;
  profile_url: string | null;
  fav_brand_id: number | null;
  social: string;
  bio: string | null;
  visibility: number; // 0: Mutual, 1: Public
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
