import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisPubSubService } from './redis-pubsub.service';
import { RedisStreamService } from './redis-stream.service';

@Global()
@Module({
  providers: [RedisService, RedisPubSubService, RedisStreamService],
  exports: [RedisService, RedisPubSubService, RedisStreamService],
})
export class RedisModule {}
