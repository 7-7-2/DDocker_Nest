import { Module } from '@nestjs/common';
import { FollowService } from './follow.service';
import { FollowController } from './follow.controller';
import { FollowRepository } from './follow.repository';
import { NotificationModule } from '../notification/notification.module';
import { RedisModule } from '../../providers/redis/redis.module';

@Module({
  imports: [NotificationModule, RedisModule],
  controllers: [FollowController],
  providers: [FollowService, FollowRepository],
  exports: [FollowService],
})
export class FollowModule {}
