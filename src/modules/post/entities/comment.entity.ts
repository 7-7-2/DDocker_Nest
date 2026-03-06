export interface CommentRow {
  id: number;
  user_id: string;
  post_id: string;
  content: string;
  created_at: Date;
  deleted_at: Date | null;
}
