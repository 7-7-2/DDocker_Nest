import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../providers/redis/redis.service';
import { RedisStreamService } from '../../providers/redis/redis-stream.service';
import { DynamoDbService } from '../../providers/dynamodb/dynamodb.service';
import { UserService } from '../user/user.service';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { NotificationRow } from './entities/notification.entity';

import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class NotificationConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationConsumer.name);
  private readonly STREAM_NAME: string;
  private readonly GROUP_NAME: string;
  private readonly CONSUMER_NAME: string;
  private readonly REDIS_PREFIX = 'notifications:';

  constructor(
    private readonly redisService: RedisService,
    private readonly redisStreamService: RedisStreamService,
    private readonly dynamoDbService: DynamoDbService,
    private readonly configService: ConfigService,
    private readonly userService: UserService,
  ) {
    this.STREAM_NAME =
      this.configService.get<string>('REDIS_STREAM_NAME') || 'notifications';
    this.GROUP_NAME =
      this.configService.get<string>('REDIS_GROUP_NAME') || 'nestconsumer';
    this.CONSUMER_NAME =
      process.env.NODE_ENV === 'development'
        ? 'consumer-local-dev'
        : `consumer-${uuidv4().slice(0, 8)}`;
  }

  async onApplicationBootstrap() {
    this.logger.log(
      `Initializing NotificationConsumer [${this.CONSUMER_NAME}]...`,
    );

    await this.setupStream();

    // Start background processing
    setImmediate(async () => {
      await this.claimOrphanedMessages();
      await this.processPendingMessages();
      this.logger.log('Starting Redis Stream polling loop...');
      this.pollStream().catch((err) => {
        this.logger.error('Fatal error in polling loop', err);
      });
    });
  }

  //In case write to DB failed
  private async claimOrphanedMessages() {
    this.logger.log('Checking for orphaned messages in PEL...');
    try {
      const pendingInfo = await this.redisStreamService.xpending(
        this.STREAM_NAME,
        this.GROUP_NAME,
        '-',
        '+',
        10,
      );

      if (pendingInfo && pendingInfo.length > 0) {
        const idsToClaim = pendingInfo
          .filter((p) => p[1] !== this.CONSUMER_NAME)
          .map((p) => p[0]);

        if (idsToClaim.length > 0) {
          this.logger.log(`Claiming ${idsToClaim.length} orphaned messages...`);
          await this.redisStreamService.xclaim(
            this.STREAM_NAME,
            this.GROUP_NAME,
            this.CONSUMER_NAME,
            10000, // min idle time 10s
            ...idsToClaim,
          );
        }
      }
    } catch (error) {
      this.logger.warn('Failed to claim orphaned messages (non-fatal)');
    }
  }

  private async processPendingMessages() {
    this.logger.log('Checking for all pending messages in PEL...');
    try {
      const results = await this.redisStreamService.xreadgroup(
        this.GROUP_NAME,
        this.CONSUMER_NAME,
        this.STREAM_NAME,
        10,
        0,
      );

      if (results && results?.length > 0) {
        const [_stream, messages] = results[0];
        this.logger.log(
          `Found ${messages.length} pending messages for [${this.CONSUMER_NAME}]. Processing...`,
        );
        for (const [id, fields] of messages) {
          await this.processMessage(id, fields);
        }
      }
    } catch (error) {
      this.logger.error('Error processing pending messages', error);
    }
  }

  private async setupStream() {
    try {
      await this.redisStreamService.xgroup(
        'CREATE',
        this.STREAM_NAME,
        this.GROUP_NAME,
        '$',
      );
      this.logger.log(`Redis Stream Group "${this.GROUP_NAME}" is ready.`);
    } catch (error) {
      this.logger.warn(`Potential issue during xgroup setup: ${error}`);
    }
  }

  private async pollStream() {
    while (true) {
      try {
        this.logger.debug(
          `Polling stream ${this.STREAM_NAME} group ${this.GROUP_NAME}...`,
        );
        const results = await this.redisStreamService.xreadgroup(
          this.GROUP_NAME,
          this.CONSUMER_NAME,
          this.STREAM_NAME,
          1,
          2000,
        );

        if (results && results.length > 0) {
          const [_stream, messages] = results[0];
          this.logger.log(`Received ${messages.length} messages from stream.`);
          for (const [id, fields] of messages) {
            await this.processMessage(id, fields);
          }
        }
      } catch (error) {
        this.logger.error('Error polling Redis Stream', error);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  private async processMessage(msgId: string, fields: string[]) {
    this.logger.log(`Processing message ${msgId}...`);
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }

      const { receiverId, senderId, senderNickname, type, postId } = data;
      const timestamp = new Date().toISOString();

      const notification: NotificationRow = {
        notificationId: msgId,
        receiverId,
        senderId,
        senderNickname,
        type: type as any,
        postId,
        timestamp,
      };

      try {
        await this.dynamoDbService.db.send(
          new PutCommand({
            TableName: this.dynamoDbService.table,
            Item: notification,
            ConditionExpression: 'attribute_not_exists(notificationId)',
          }),
        );
      } catch (error) {
        if (error.name === 'ConditionalCheckFailedException') {
          this.logger.warn(
            `Notification ${msgId} already exists in DynamoDB. Skipping save.`,
          );
        } else {
          this.logger.error(`DynamoDB Error for ${msgId}: ${error.message}`);
          throw error;
        }
      }

      const lastRead = await this.userService.getLastNotiRead(receiverId);
      const lastReadAt = lastRead
        ? dayjs(lastRead).subtract(9, 'hour').toISOString()
        : dayjs(new Date()).subtract(9, 'hour').toISOString();

      const signalPayload = {
        notificationId: notification.notificationId,
        receiverId: notification.receiverId,
        senderId: notification.senderId,
        senderNickname: notification.senderNickname,
        type: notification.type,
        postId: notification.postId,
        time: notification.timestamp,
        isRead: notification.timestamp <= lastReadAt,
      };

      await this.redisService.publish(
        `${this.REDIS_PREFIX}${receiverId}`,
        signalPayload,
      );

      await this.redisStreamService.xack(
        this.STREAM_NAME,
        this.GROUP_NAME,
        msgId,
      );
    } catch (error) {
      this.logger.error(`Failed to process message ${msgId}`, error);
    }
  }
}
