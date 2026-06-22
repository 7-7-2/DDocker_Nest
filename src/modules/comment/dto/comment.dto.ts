import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsNumber } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  postId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  content: string;
}

export class CreateReplyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  postId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  commentId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  content: string;
}

export class CommentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ required: false })
  profileUrl?: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  replyCount: number;

  @ApiProperty()
  isDeleted: boolean;

  static fromRow(row: any): CommentResponseDto {
    const isDeleted = !!row.deleted_at;
    return {
      id: row.id,
      userId: row.user_id,
      nickname: row.nickname,
      profileUrl: row.profile_url || undefined,
      content: isDeleted ? '삭제된 댓글입니다.' : row.content,
      createdAt: row.created_at,
      replyCount: Number(row.reply_count || 0),
      isDeleted,
    };
  }
}

export class ReplyResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  commentId: number;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty({ required: false })
  profileUrl?: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  isDeleted: boolean;

  static fromRow(row: any): ReplyResponseDto {
    const isDeleted = !!row.deleted_at;
    return {
      id: row.id,
      commentId: row.comment_id,
      userId: row.user_id,
      nickname: row.nickname,
      profileUrl: row.profile_url || undefined,
      content: isDeleted ? '삭제된 답글입니다.' : row.content,
      createdAt: row.created_at,
      isDeleted,
    };
  }
}

export class DeleteCommentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  commentId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  postId: string;
}

export class DeleteReplyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  replyId: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  postId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  commentId: number;
}
