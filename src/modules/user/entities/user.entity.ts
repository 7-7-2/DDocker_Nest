export interface UserRow {
  id: number;
  public_id: string;
  useremail: string;
  nickname: string | null;
  profile_url: string | null;
  fav_brand_id: number | null;
  social: string;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  account_privacy: number; // 0: Public, 1: Private
}
