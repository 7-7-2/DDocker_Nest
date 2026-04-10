import { Module } from '@nestjs/common';
import { CommentService } from './comment.service';
import { CommentController } from './comment.controller';
import { CommentRepository } from './comment.repository';
import { PostModule } from '../post/post.module';
import { NotificationModule } from '../notification/notification.module';
import { RedisModule } from '../../providers/redis/redis.module';

@Module({
  imports: [PostModule, NotificationModule, RedisModule],
  controllers: [CommentController],
  providers: [CommentService, CommentRepository],
})
export class CommentModule {}
