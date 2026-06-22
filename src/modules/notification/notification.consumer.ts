import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../providers/redis/redis.service';
import { RedisStreamService } from '../../providers/redis/redis-stream.service';
import { DynamoDbService } from '../../providers/dynamodb/dynamodb.service';
import { UserService } from '../user/user.service';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { NotificationRow } from './entities/notification.entity';
import { NotificationResponseDto } from './dto/notification-payload.dto';
import { DateUtil } from '../../common/utils/date.util';

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
    setImmediate(() => {
      this.claimOrphanedMessages().catch((err: Error) => {
        this.logger.warn(`Orphaned message claim failed: ${err.message}`);
      });
      this.processPendingMessages().catch((err: Error) => {
        this.logger.warn(`Pending message processing failed: ${err.message}`);
      });
      this.logger.log('Starting Redis Stream polling loop...');
      this.pollStream().catch((err: Error) => {
        this.logger.error('Fatal error in polling loop', err);
      });
    });
  }

  // In case write to DB failed
  private async claimOrphanedMessages() {
    this.logger.log('Checking for orphaned messages in PEL...');
    try {
      const pendingInfo = (await this.redisStreamService.xpending(
        this.STREAM_NAME,
        this.GROUP_NAME,
        '-',
        '+',
        10,
      )) as [string, string, number, number][];

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
      this.logger.warn(
        `Failed to claim orphaned messages (non-fatal): ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  async processPendingMessages() {
    this.logger.log('Checking for all pending messages in PEL...');
    try {
      const results = (await this.redisStreamService.xreadgroup(
        this.GROUP_NAME,
        this.CONSUMER_NAME,
        this.STREAM_NAME,
        10,
        0,
      )) as [string, [string, string[]][]][] | null;

      if (results && results.length > 0) {
        const messages = results[0][1];
        this.logger.log(
          `Found ${messages.length} pending messages for [${this.CONSUMER_NAME}]. Processing...`,
        );
        for (const [id, fields] of messages) {
          await this.processMessage(id, fields);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing pending messages: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
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
      this.logger.warn(
        `Potential issue during xgroup setup: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
    }
  }

  private async pollStream() {
    while (true) {
      try {
        this.logger.debug(
          `Polling stream ${this.STREAM_NAME} group ${this.GROUP_NAME}...`,
        );
        const results = (await this.redisStreamService.xreadgroup(
          this.GROUP_NAME,
          this.CONSUMER_NAME,
          this.STREAM_NAME,
          1,
          2000,
        )) as [string, [string, string[]][]][] | null;

        if (results && results.length > 0) {
          const messages = results[0][1];
          this.logger.log(`Received ${messages.length} messages from stream.`);
          for (const [id, fields] of messages) {
            await this.processMessage(id, fields);
          }
        }
      } catch (error) {
        this.logger.error(
          `Error polling Redis Stream: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  async processMessage(msgId: string, fields: string[]) {
    this.logger.log(`Processing message ${msgId}...`);
    try {
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const value = fields[i + 1];
        if (key && value) {
          data[key] = value;
        }
      }

      const { receiverId, senderId, senderNickname, type, postId } = data;
      const timestamp = new Date().toISOString();

      const notification: NotificationRow = {
        notificationId: msgId,
        receiverId,
        senderId,
        senderNickname,
        type: type as NotificationRow['type'],
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
        const dynamoError = error as { name?: string; message?: string };
        if (dynamoError.name === 'ConditionalCheckFailedException') {
          this.logger.warn(
            `Notification ${msgId} already exists in DynamoDB. Skipping save.`,
          );
        } else {
          this.logger.error(
            `DynamoDB Error for ${msgId}: ${dynamoError.message ?? 'Unknown'}`,
          );
          throw error;
        }
      }

      const lastRead = await this.userService.getLastNotiRead(receiverId);
      const lastReadAt = lastRead
        ? DateUtil.toUtc(lastRead).toISOString()
        : DateUtil.toUtc(new Date()).toISOString();

      const signalPayload: NotificationResponseDto = {
        notificationId: notification.notificationId,
        type: notification.type as NotificationResponseDto['type'],
        senderId: notification.senderId,
        senderNickname: notification.senderNickname,
        postId: notification.postId,
        time: notification.timestamp,
        timestamp: notification.timestamp,
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
