import {
  Logger,
  CanActivate,
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CommentService } from '../comment.service';

@Injectable()
export class CommentDeleteGuard implements CanActivate {
  private readonly logger = new Logger(CommentDeleteGuard.name);
  constructor(private readonly commentService: CommentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const dto = request.body;
    const user = request.user;

    if (!user || !user.public_id) {
      return false;
    }

    const userId = user.public_id;
    const isReply = !!dto.replyId;
    const targetId = isReply ? dto.replyId : dto.commentId;
    const type = isReply ? 'reply' : 'comment';

    if (!targetId) {
      return false;
    }

    const canDelete = await this.commentService.checkDeletionPermission(
      type,
      targetId,
      userId,
    );
    this.logger.log('canDelete', canDelete);
    if (!canDelete) {
      throw new ForbiddenException(
        `이 ${isReply ? '답글' : '댓글'}을 삭제할 권한이 없습니다.`,
      );
    }

    return true;
  }
}
