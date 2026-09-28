import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService, IdempotencyRecord } from './idempotency.service';
import { RedisService } from '../../providers/redis/redis.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { REDIS_KEYS } from '../constants/redis-keys';
import { Mock } from '../../test-utils/types';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let redisService: Mock<RedisService>;

  const userId = 'user-test-uuid-1';
  const idempotencyKey = 'key-nano-id-123';
  const expectedRedisKey = REDIS_KEYS.IDEMPOTENCY(userId, idempotencyKey);

  beforeEach(async () => {
    const redisMock = createRedisServiceMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('lockOrGet', () => {
    it('should return ACQUIRED when redis key does not exist (setNx succeeds)', async () => {
      redisService.setNx!.mockResolvedValue(true);

      const result = await service.lockOrGet(userId, idempotencyKey, 60);

      expect(result).toEqual({ state: 'ACQUIRED' });
      expect(redisService.setNx).toHaveBeenCalledWith(
        expectedRedisKey,
        expect.objectContaining({
          status: 'PENDING',
        }),
        60,
      );
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should return PENDING when key exists with status PENDING', async () => {
      redisService.setNx!.mockResolvedValue(false);
      const pendingRecord: IdempotencyRecord = {
        status: 'PENDING',
        createdAt: Date.now(),
      };
      redisService.get!.mockResolvedValue(pendingRecord);

      const result = await service.lockOrGet(userId, idempotencyKey);

      expect(result).toEqual({ state: 'PENDING' });
      expect(redisService.get).toHaveBeenCalledWith(expectedRedisKey);
    });

    it('should return COMPLETED with cached response when key exists with status COMPLETED', async () => {
      redisService.setNx!.mockResolvedValue(false);
      const cachedResponse = { success: true, intakeId: 99 };
      const completedRecord: IdempotencyRecord = {
        status: 'COMPLETED',
        response: cachedResponse,
        createdAt: Date.now(),
      };
      redisService.get!.mockResolvedValue(completedRecord);

      const result = await service.lockOrGet(userId, idempotencyKey);

      expect(result).toEqual({
        state: 'COMPLETED',
        response: cachedResponse,
      });
      expect(redisService.get).toHaveBeenCalledWith(expectedRedisKey);
    });

    it('should return PENDING if key exists but get returns null (race/expiration)', async () => {
      redisService.setNx!.mockResolvedValue(false);
      redisService.get!.mockResolvedValue(null);

      const result = await service.lockOrGet(userId, idempotencyKey);

      expect(result).toEqual({ state: 'PENDING' });
    });
  });

  describe('saveResponse', () => {
    it('should save COMPLETED record with response data and 24h TTL in redis', async () => {
      const responsePayload = { success: true, postId: 'post-xyz' };

      await service.saveResponse(
        userId,
        idempotencyKey,
        responsePayload,
        86400,
      );

      expect(redisService.set).toHaveBeenCalledWith(
        expectedRedisKey,
        expect.objectContaining({
          status: 'COMPLETED',
          response: responsePayload,
        }),
        86400,
      );
    });
  });

  describe('rollback', () => {
    it('should delete the idempotency key from redis', async () => {
      await service.rollback(userId, idempotencyKey);

      expect(redisService.del).toHaveBeenCalledWith(expectedRedisKey);
    });
  });
});
