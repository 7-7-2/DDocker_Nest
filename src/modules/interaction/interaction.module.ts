import { Module } from '@nestjs/common';
import { InteractionListener } from './interaction.listener';
import { NotificationModule } from '../notification/notification.module';
import { RedisModule } from '../../providers/redis/redis.module';

@Module({
  imports: [NotificationModule, RedisModule],
  providers: [InteractionListener],
})
export class InteractionModule {}
