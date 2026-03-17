export interface CommentRow {
  id: number;
  user_id: string;
  post_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ReplyRow {
  id: number;
  user_id: string;
  comment_id: number;
  post_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface CommentWithAuthorRow extends CommentRow {
  nickname: string;
  profile_url: string | null;
  reply_count: number;
}

export interface ReplyWithAuthorRow extends ReplyRow {
  nickname: string;
  profile_url: string | null;
}
