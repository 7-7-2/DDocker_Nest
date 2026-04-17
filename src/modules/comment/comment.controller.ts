import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { CommentDeleteGuard } from './guard/comment-delete.guard';
import {
  CreateCommentDto,
  CreateReplyDto,
  CommentResponseDto,
  ReplyResponseDto,
  DeleteCommentDto,
  DeleteReplyDto,
} from './dto/comment.dto';

@ApiTags('Comments')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '게시글 댓글 작성' })
  @ApiResponse({ status: 200, description: 'Comment added' })
  async createComment(
    @GetUser('public_id') userId: string,
    @GetUser('nickname') nickname: string,
    @Body() dto: CreateCommentDto,
  ) {
    await this.commentService.createComment(userId, nickname, dto);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '댓글 밑 답글 작성' })
  @ApiResponse({ status: 200, description: 'Reply added' })
  async createReply(
    @GetUser('public_id') userId: string,
    @Body() dto: CreateReplyDto,
  ) {
    await this.commentService.createReply(userId, dto);
    return { success: true };
  }

  @Get('post/:postId')
  @ApiOperation({ summary: '게시글 댓글 조회(답글 제외)' })
  @ApiResponse({ status: 200, type: [CommentResponseDto] })
  async getCommentsByPost(
    @Param('postId') postId: string,
  ): Promise<CommentResponseDto[]> {
    return await this.commentService.getCommentsByPost(postId);
  }

  @Get(':commentId/replies')
  @ApiOperation({ summary: '특정 댓글 밑 답글 전체조회' })
  @ApiResponse({ status: 200, type: [ReplyResponseDto] })
  async getRepliesByComment(
    @Param('commentId') commentId: string,
  ): Promise<ReplyResponseDto[]> {
    return await this.commentService.getRepliesByComment(
      parseInt(commentId, 10),
    );
  }

  @UseGuards(JwtAuthGuard, CommentDeleteGuard)
  @ApiBearerAuth()
  @Delete()
  @ApiOperation({ summary: '댓글 삭제(Soft-delete)' })
  async deleteComment(
    @GetUser('public_id') userId: string,
    @Body() dto: DeleteCommentDto,
  ) {
    await this.commentService.deleteComment(userId, dto);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, CommentDeleteGuard)
  @ApiBearerAuth()
  @Delete('reply')
  @ApiOperation({ summary: '답글 삭제(Soft-delete)' })
  async deleteReply(
    @GetUser('public_id') userId: string,
    @Body() dto: DeleteReplyDto,
  ) {
    await this.commentService.deleteReply(userId, dto);
    return { success: true };
  }
}
