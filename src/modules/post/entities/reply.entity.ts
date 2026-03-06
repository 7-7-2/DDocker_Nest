export interface ReplyRow {
  id: number;
  user_id: string;
  comment_id: number;
  content: string;
  created_at: Date;
  deleted_at: Date | null;
}
