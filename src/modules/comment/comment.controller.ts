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
import {
  CreateCommentDto,
  CreateReplyDto,
  CommentResponseDto,
  ReplyResponseDto,
} from './dto/comment.dto';

@ApiTags('comments')
@Controller('comments')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add a top-level comment to a post' })
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
  @ApiOperation({ summary: 'Add a nested reply to a comment' })
  @ApiResponse({ status: 200, description: 'Reply added' })
  async createReply(
    @GetUser('public_id') userId: string,
    @Body() dto: CreateReplyDto,
  ) {
    await this.commentService.createReply(userId, dto);
    return { success: true };
  }

  @Get('post/:postId')
  @ApiOperation({ summary: 'Get all comments for a post' })
  @ApiResponse({ status: 200, type: [CommentResponseDto] })
  async getCommentsByPost(
    @Param('postId') postId: string,
  ): Promise<CommentResponseDto[]> {
    return await this.commentService.getCommentsByPost(postId);
  }

  @Get(':commentId/replies')
  @ApiOperation({ summary: 'Get all replies for a comment' })
  @ApiResponse({ status: 200, type: [ReplyResponseDto] })
  async getRepliesByComment(
    @Param('commentId') commentId: string,
  ): Promise<ReplyResponseDto[]> {
    return await this.commentService.getRepliesByComment(
      parseInt(commentId, 10),
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a comment' })
  async deleteComment(
    @GetUser('public_id') userId: string,
    @Param('id') id: string,
  ) {
    await this.commentService.deleteComment(userId, parseInt(id, 10));
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('reply/:id')
  @ApiOperation({ summary: 'Soft-delete a reply' })
  async deleteReply(
    @GetUser('public_id') userId: string,
    @Param('id') id: string,
  ) {
    await this.commentService.deleteReply(userId, parseInt(id, 10));
    return { success: true };
  }
}
