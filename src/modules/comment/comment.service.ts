import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CommentRepository } from './comment.repository';
import {
  CreateCommentDto,
  CreateReplyDto,
  CommentResponseDto,
  ReplyResponseDto,
} from './dto/comment.dto';
import {
  CommentWithAuthorRow,
  ReplyWithAuthorRow,
} from './entities/comment.entity';
import { PostRepository } from '../post/post.repository';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class CommentService {
  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postRepository: PostRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async createComment(
    userId: string,
    commenterNickname: string,
    dto: CreateCommentDto,
  ): Promise<void> {
    const post = await this.postRepository.findPostDetail(dto.postId);
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const queryRunner = await this.commentRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.commentRepository.insertComment(
        {
          user_id: userId,
          post_id: dto.postId,
          content: dto.content,
        },
        queryRunner,
      );

      await this.commentRepository.incrementCommentCount(
        dto.postId,
        queryRunner,
      );

      await queryRunner.commitTransaction();

      if (userId !== post.user_id) {
        await this.notificationService.pushNotification(post.user_id, {
          type: 'comment',
          senderId: userId,
          nickname: commenterNickname,
          postId: dto.postId,
          time: new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }),
        });
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to add comment');
    } finally {
      await queryRunner.release();
    }
  }

  async createReply(userId: string, dto: CreateReplyDto): Promise<void> {
    const queryRunner = await this.commentRepository.getQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.commentRepository.insertReply(
        {
          user_id: userId,
          comment_id: dto.commentId,
          post_id: dto.postId,
          content: dto.content,
        },
        queryRunner,
      );

      await this.commentRepository.incrementCommentCount(
        dto.postId,
        queryRunner,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new InternalServerErrorException('Failed to add reply');
    } finally {
      await queryRunner.release();
    }
  }

  async deleteComment(userId: string, commentId: number): Promise<void> {
    await this.commentRepository.softDeleteComment(userId, commentId);
  }

  async deleteReply(userId: string, replyId: number): Promise<void> {
    await this.commentRepository.softDeleteReply(userId, replyId);
  }

  async getCommentsByPost(postId: string): Promise<CommentResponseDto[]> {
    const rows = await this.commentRepository.findCommentsByPost(postId);
    return rows.map((row) => this.mapCommentRowToDto(row));
  }

  async getRepliesByComment(commentId: number): Promise<ReplyResponseDto[]> {
    const rows = await this.commentRepository.findRepliesByComment(commentId);
    return rows.map((row) => this.mapReplyRowToDto(row));
  }

  private mapCommentRowToDto(row: CommentWithAuthorRow): CommentResponseDto {
    const isDeleted = row.deleted_at !== null;
    return {
      id: row.id,
      userId: row.user_id,
      nickname: row.nickname,
      profileUrl: row.profile_url || undefined,
      content: isDeleted ? '삭제된 댓글입니다.' : row.content,
      createdAt: row.created_at,
      replyCount: row.reply_count,
      isDeleted,
    };
  }

  private mapReplyRowToDto(row: ReplyWithAuthorRow): ReplyResponseDto {
    const isDeleted = row.deleted_at !== null;
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
