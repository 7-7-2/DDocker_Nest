import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import {
  NotificationPayloadDto,
  NotificationResponseDto,
} from './dto/notification-payload.dto';
import { interval, map, merge, Observable } from 'rxjs';

import { RedisStreamService } from '../../providers/redis/redis-stream.service';
import { RedisPubSubService } from '../../providers/redis/redis-pubsub.service';
import { DynamoDbService } from '../../providers/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NotificationRow } from './entities/notification.entity';
import { UserService } from '../user/user.service';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly REDIS_PREFIX = 'notifications:';
  private readonly STREAM_NAME: string;

  constructor(
    private readonly redisStreamService: RedisStreamService,
    private readonly redisPubSubService: RedisPubSubService,
    private readonly dynamoDbService: DynamoDbService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    this.STREAM_NAME =
      this.configService.get<string>('REDIS_STREAM_NAME') || 'notifications';
  }

  async pushNotification(
    receiverId: string,
    payload: NotificationPayloadDto,
  ): Promise<void> {
    try {
      await this.redisStreamService.xadd(
        this.STREAM_NAME,
        '*',
        {
          receiverId,
          ...payload,
        },
        1000,
      );
    } catch (error) {
      this.logger.error('Failed to push notification to stream', error);
    }
  }

  getNotificationStream(userId: string): Observable<MessageEvent> {
    const key = `${this.REDIS_PREFIX}${userId}`;
    const notificationStream = this.redisPubSubService
      .fromChannel(key)
      .pipe(map((item) => item as MessageEvent));

    const pingStream = interval(300000).pipe(
      map((): MessageEvent => ({ type: 'ping', data: 'heartbeat' })),
    );

    return merge(notificationStream, pingStream);
  }

  async getHistory(
    userId: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{
    items: NotificationResponseDto[];
    nextCursor?: string;
    lastReadAt: string;
  }> {
    const lastRead = await this.userService.getLastNotiRead(userId);
    const lastReadAt = lastRead
      ? dayjs(lastRead).subtract(9, 'hour').toISOString()
      : dayjs(new Date()).subtract(9, 'hour').toISOString();

    const command = new QueryCommand({
      TableName: this.dynamoDbService.table,
      IndexName: 'receiverId-timestamp-index',
      KeyConditionExpression: 'receiverId = :rid',
      ExpressionAttributeValues: {
        ':rid': userId,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: cursor
        ? { receiverId: userId, timestamp: cursor, notificationId: 'unknown' }
        : undefined,
    });

    const result = await this.dynamoDbService.db.send(command);
    const items = (result.Items as NotificationRow[]) || [];

    return {
      items: items.map((item) => ({
        notificationId: item.notificationId,
        type: item.type,
        senderId: item.senderId,
        senderNickname: item.senderNickname,
        postId: item.postId,
        time: item.timestamp,
        timestamp: item.timestamp,
        isRead: item.timestamp <= lastReadAt,
      })),
      nextCursor: result.LastEvaluatedKey
        ? result.LastEvaluatedKey.timestamp
        : undefined,
      lastReadAt,
    };
  }

  async markAllAsRead(userId: string): Promise<Date | null> {
    await this.userService.updateLastNotiRead(userId);
    return this.userService.getLastNotiRead(userId);
  }
}
