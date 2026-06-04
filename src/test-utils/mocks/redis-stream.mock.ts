import { RedisStreamService } from '../../providers/redis/redis-stream.service';
import { RedisPubSubService } from '../../providers/redis/redis-pubsub.service';
import { Mock } from '../types';

export const createRedisStreamServiceMock = (): Mock<RedisStreamService> => ({
  xadd: jest.fn(),
  xgroup: jest.fn(),
  xreadgroup: jest.fn(),
  xack: jest.fn(),
  xpending: jest.fn(),
  xclaim: jest.fn(),
});

export const createRedisPubSubServiceMock = (): Mock<RedisPubSubService> => ({
  fromChannel: jest.fn(),
});
