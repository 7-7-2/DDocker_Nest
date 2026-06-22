import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CommentRepository } from './comment.repository';
import {
  CreateCommentDto,
  CreateReplyDto,
  CommentResponseDto,
  ReplyResponseDto,
  DeleteCommentDto,
  DeleteReplyDto,
} from './dto/comment.dto';
import { PostRepository } from '../post/post.repository';
import { RedisService } from '../../providers/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { REDIS_KEYS } from '../../common/constants/redis-keys';
import {
  CommentCreatedEvent,
  ReplyCreatedEvent,
  CommentDeletedEvent,
  ReplyDeletedEvent,
} from '../../common/events/interaction.events';
import { TransactionManager } from '../../common/database/transaction.manager';

@Injectable()
export class CommentService {
  private readonly logger = new Logger(CommentService.name);

  constructor(
    private readonly commentRepository: CommentRepository,
    private readonly postRepository: PostRepository,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly txManager: TransactionManager,
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

    await this.txManager.run(
      async (queryRunner) => {
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
      },
      {
        logger: this.logger,
        context: 'createComment',
        message: 'Failed to add comment',
      },
    );

    this.eventEmitter.emit(
      'comment.created',
      new CommentCreatedEvent(
        userId,
        commenterNickname,
        dto.postId,
        post.user_id,
        dto.content,
      ),
    );
  }

  async createReply(userId: string, dto: CreateReplyDto): Promise<void> {
    await this.txManager.run(
      async (queryRunner) => {
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
      },
      {
        logger: this.logger,
        context: 'createReply',
        message: 'Failed to add reply',
      },
    );

    this.eventEmitter.emit(
      'reply.created',
      new ReplyCreatedEvent(
        userId,
        '', // nickname not strictly required here based on payload but good to have
        dto.postId,
        dto.commentId,
        dto.content,
      ),
    );
  }

  async deleteComment(userId: string, dto: DeleteCommentDto): Promise<void> {
    await this.txManager.run(
      async (queryRunner) => {
        await this.commentRepository.softDeleteComment(
          dto.commentId,
          dto.postId,
          queryRunner,
        );

        await this.commentRepository.decrementCommentCount(
          dto.postId,
          queryRunner,
        );
      },
      {
        logger: this.logger,
        context: 'deleteComment',
        message: 'Failed to delete comment',
      },
    );

    this.eventEmitter.emit(
      'comment.deleted',
      new CommentDeletedEvent(dto.postId, dto.commentId),
    );
  }

  async deleteReply(userId: string, dto: DeleteReplyDto): Promise<void> {
    await this.txManager.run(
      async (queryRunner) => {
        await this.commentRepository.softDeleteReply(
          dto.replyId,
          dto.commentId,
          dto.postId,
          queryRunner,
        );

        await this.commentRepository.decrementCommentCount(
          dto.postId,
          queryRunner,
        );
      },
      {
        logger: this.logger,
        context: 'deleteReply',
        message: 'Failed to delete reply',
      },
    );

    this.eventEmitter.emit(
      'reply.deleted',
      new ReplyDeletedEvent(dto.postId, dto.commentId),
    );
  }

  async getCommentsByPost(postId: string): Promise<CommentResponseDto[]> {
    return await this.redisService.getOrSet(
      REDIS_KEYS.POST.COMMENTS(postId),
      300,
      async () => {
        const rows = await this.commentRepository.findCommentsByPost(postId);
        return rows.map((row) => CommentResponseDto.fromRow(row));
      },
    );
  }

  async getRepliesByComment(commentId: number): Promise<ReplyResponseDto[]> {
    return await this.redisService.getOrSet(
      REDIS_KEYS.COMMENT.REPLIES(commentId),
      300,
      async () => {
        const rows =
          await this.commentRepository.findRepliesByComment(commentId);
        return rows.map((row) => ReplyResponseDto.fromRow(row));
      },
    );
  }

  async checkDeletionPermission(
    type: 'comment' | 'reply',
    id: number,
    userId: string,
  ): Promise<boolean> {
    return await this.commentRepository.checkDeletionPermission(
      type,
      id,
      userId,
    );
  }
}
