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
  postId: string; // Required for stat tracking

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
}
