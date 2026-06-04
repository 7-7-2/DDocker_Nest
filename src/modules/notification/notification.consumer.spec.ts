import { Test, TestingModule } from '@nestjs/testing';
import { NotificationConsumer } from './notification.consumer';
import { RedisService } from '../../providers/redis/redis.service';
import { RedisStreamService } from '../../providers/redis/redis-stream.service';
import { DynamoDbService } from '../../providers/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { createRedisStreamServiceMock } from '../../test-utils/mocks/redis-stream.mock';
import { createDynamoDbServiceMock } from '../../test-utils/mocks/dynamodb.service.mock';
import { createConfigServiceMock } from '../../test-utils/mocks/config.service.mock';
import { createUserServiceMock } from '../../test-utils/mocks/user.service.mock';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { Mock } from '../../test-utils/types';
import { NotificationResponseDto } from './dto/notification-payload.dto';

describe('NotificationConsumer', () => {
  let consumer: NotificationConsumer;
  let redisService: Mock<RedisService>;
  let redisStreamService: Mock<RedisStreamService>;
  let dynamoDbService: Mock<DynamoDbService>;
  let userService: Mock<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConsumer,
        { provide: RedisService, useValue: createRedisServiceMock() },
        {
          provide: RedisStreamService,
          useValue: createRedisStreamServiceMock(),
        },
        { provide: DynamoDbService, useValue: createDynamoDbServiceMock() },
        { provide: ConfigService, useValue: createConfigServiceMock() },
        { provide: UserService, useValue: createUserServiceMock() },
      ],
    }).compile();

    consumer = module.get<NotificationConsumer>(NotificationConsumer);
    redisService = module.get(RedisService);
    redisStreamService = module.get(RedisStreamService);
    dynamoDbService = module.get(DynamoDbService);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(consumer).toBeDefined();
  });

  describe('processMessage (Isolation)', () => {
    it('should transform redis fields, save to DynamoDB, and publish real-time signal', async () => {
      const msgId = '12345-0';
      const fields = [
        'receiverId',
        'user-target',
        'senderId',
        'user-sender',
        'senderNickname',
        'CoolCat',
        'type',
        'like',
        'postId',
        'post-99',
      ];

      userService.getLastNotiRead!.mockResolvedValue(
        new Date('2024-01-01T00:00:00Z'),
      );
      (dynamoDbService.db!.send as jest.Mock).mockResolvedValue({});
      redisService.publish!.mockResolvedValue(1);
      redisStreamService.xack!.mockResolvedValue(1);

      await consumer.processMessage(msgId, fields);

      expect(dynamoDbService.db!.send).toHaveBeenCalledWith(
        expect.any(PutCommand),
      );

      const sendMock = dynamoDbService.db!.send as jest.Mock;
      const lastCall = sendMock.mock.calls[0] as [PutCommand];
      const putCommand = lastCall[0];

      expect(putCommand.input.Item).toEqual(
        expect.objectContaining({
          notificationId: msgId,
          receiverId: 'user-target',
          type: 'like',
        }),
      );

      expect(redisService.publish).toHaveBeenCalledWith(
        'notifications:user-target',
        expect.objectContaining({
          notificationId: msgId,
          isRead: false,
        } as NotificationResponseDto),
      );

      expect(redisStreamService.xack).toHaveBeenCalledWith(
        'notifications',
        'nestconsumer',
        msgId,
      );
    });

    it('should handle duplicate notification errors gracefully and still ack', async () => {
      const fields = ['receiverId', 'u1', 'type', 'follow'];
      const error = new Error('Duplicate');
      (error as { name: string }).name = 'ConditionalCheckFailedException';
      (dynamoDbService.db!.send as jest.Mock).mockRejectedValue(error);
      userService.getLastNotiRead!.mockResolvedValue(new Date());
      redisService.publish!.mockResolvedValue(1);
      redisStreamService.xack!.mockResolvedValue(1);

      await consumer.processMessage('msg-1', fields);

      expect(redisStreamService.xack).toHaveBeenCalledWith(
        'notifications',
        'nestconsumer',
        'msg-1',
      );
    });
  });
});
