import { Module } from '@nestjs/common';
import { LikeService } from './like.service';
import { LikeController } from './like.controller';
import { LikeRepository } from './like.repository';
import { PostModule } from '../post/post.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [PostModule, NotificationModule],
  controllers: [LikeController],
  providers: [LikeService, LikeRepository],
  exports: [LikeService],
})
export class LikeModule {}
