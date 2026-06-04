import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { RedisStreamService } from '../../providers/redis/redis-stream.service';
import { RedisPubSubService } from '../../providers/redis/redis-pubsub.service';
import { DynamoDbService } from '../../providers/dynamodb/dynamodb.service';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../user/user.service';
import {
  createRedisStreamServiceMock,
  createRedisPubSubServiceMock,
} from '../../test-utils/mocks/redis-stream.mock';
import { createDynamoDbServiceMock } from '../../test-utils/mocks/dynamodb.service.mock';
import { createConfigServiceMock } from '../../test-utils/mocks/config.service.mock';
import { createUserServiceMock } from '../../test-utils/mocks/user.service.mock';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { NotificationPayloadDto } from './dto/notification-payload.dto';
import { of } from 'rxjs';
import { Mock } from '../../test-utils/types';

describe('NotificationService', () => {
  let service: NotificationService;
  let redisStreamService: Mock<RedisStreamService>;
  let redisPubSubService: Mock<RedisPubSubService>;
  let dynamoDbService: Mock<DynamoDbService>;
  let userService: Mock<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: RedisStreamService,
          useValue: createRedisStreamServiceMock(),
        },
        {
          provide: RedisPubSubService,
          useValue: createRedisPubSubServiceMock(),
        },
        { provide: DynamoDbService, useValue: createDynamoDbServiceMock() },
        { provide: ConfigService, useValue: createConfigServiceMock() },
        { provide: UserService, useValue: createUserServiceMock() },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    redisStreamService = module.get(RedisStreamService);
    redisPubSubService = module.get(RedisPubSubService);
    dynamoDbService = module.get(DynamoDbService);
    userService = module.get(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('pushNotification', () => {
    it('should add message to redis stream', async () => {
      const payload: NotificationPayloadDto = {
        type: 'like',
        senderId: 'u1',
        senderNickname: 'nick',
        time: '2024-01-01',
      };
      await service.pushNotification('receiver-1', payload);

      expect(redisStreamService.xadd).toHaveBeenCalledWith(
        'notifications',
        '*',
        expect.objectContaining({ receiverId: 'receiver-1', type: 'like' }),
        1000,
      );
    });
  });

  describe('getNotificationStream', () => {
    it('should return a merged stream from pubsub', (done) => {
      const mockEvent = { data: { type: 'like', text: 'hello' } };
      redisPubSubService.fromChannel!.mockReturnValue(of(mockEvent));

      const stream$ = service.getNotificationStream('user-1');

      stream$.subscribe((event) => {
        expect(event).toEqual(mockEvent);
        done();
      });
    });
  });

  describe('getHistory', () => {
    it('should query dynamodb and map results', async () => {
      userService.getLastNotiRead!.mockResolvedValue(
        new Date('2024-01-01T00:00:00Z'),
      );
      (dynamoDbService.db!.send as jest.Mock).mockResolvedValue({
        Items: [
          {
            notificationId: 'msg-1',
            receiverId: 'user-1',
            type: 'follow',
            senderId: 'u2',
            senderNickname: 'friend',
            timestamp: '2024-01-02T10:00:00Z',
          },
        ],
      });

      const result = await service.getHistory('user-1', 10);

      expect(dynamoDbService.db!.send).toHaveBeenCalledWith(
        expect.any(QueryCommand),
      );
      expect(result.items).toHaveLength(1);
      expect(result.items[0].isRead).toBe(false); // timestamp > lastRead
    });
  });
});
