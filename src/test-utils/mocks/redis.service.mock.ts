import { RedisService } from '../../providers/redis/redis.service';
import { Mock } from '../types';

export const createRedisServiceMock = (): Mock<RedisService> => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
  getOrSet: jest.fn(
    (key: string, ttl: number, factory: () => Promise<unknown>) => factory(),
  ),
  publish: jest.fn(),
  sadd: jest.fn(),
  srem: jest.fn(),
  sismember: jest.fn(),
  zincrby: jest.fn(),
  zrevrangeWithScores: jest.fn(),
  expire: jest.fn(),
});
