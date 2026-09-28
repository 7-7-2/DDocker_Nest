import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../providers/redis/redis.service';
import { REDIS_KEYS } from '../constants/redis-keys';

export type IdempotencyStatus = 'PENDING' | 'COMPLETED';

export interface IdempotencyRecord<T = any> {
  status: IdempotencyStatus;
  response?: T;
  createdAt: number;
}

export type LockResult<T = any> =
  | { state: 'ACQUIRED' }
  | { state: 'PENDING' }
  | { state: 'COMPLETED'; response: T };

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly redisService: RedisService) {}

  async lockOrGet<T = any>(
    userId: string,
    key: string,
    lockTtlSeconds = 60,
  ): Promise<LockResult<T>> {
    const redisKey = REDIS_KEYS.IDEMPOTENCY(userId, key);
    const initialRecord: IdempotencyRecord = {
      status: 'PENDING',
      createdAt: Date.now(),
    };

    const acquired = await this.redisService.setNx(
      redisKey,
      initialRecord,
      lockTtlSeconds,
    );

    if (acquired) {
      return { state: 'ACQUIRED' };
    }

    const existing =
      await this.redisService.get<IdempotencyRecord<T>>(redisKey);
    if (existing && existing.status === 'COMPLETED') {
      return { state: 'COMPLETED', response: existing.response as T };
    }

    return { state: 'PENDING' };
  }

  async saveResponse<T = any>(
    userId: string,
    key: string,
    response: T,
    ttlSeconds = 86400,
  ): Promise<void> {
    const redisKey = REDIS_KEYS.IDEMPOTENCY(userId, key);
    const record: IdempotencyRecord<T> = {
      status: 'COMPLETED',
      response,
      createdAt: Date.now(),
    };
    await this.redisService.set(redisKey, record, ttlSeconds);
  }

  async rollback(userId: string, key: string): Promise<void> {
    const redisKey = REDIS_KEYS.IDEMPOTENCY(userId, key);
    await this.redisService.del(redisKey);
  }
}
