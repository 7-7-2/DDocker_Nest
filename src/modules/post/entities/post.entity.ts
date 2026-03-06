export interface PostRow {
  id: number;
  public_id: string;
  user_id: string;
  caffeine_intake_id: number;
  photo: string | null;
  description: string | null;
  visibility: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}
