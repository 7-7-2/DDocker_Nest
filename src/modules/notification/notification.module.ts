import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationConsumer } from './notification.consumer';
import { RedisModule } from '../../providers/redis/redis.module';
import { DynamoDbModule } from '../../providers/dynamodb/dynamodb.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [RedisModule, DynamoDbModule, UserModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationConsumer],
  exports: [NotificationService],
})
export class NotificationModule {}
