import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigType } from '@nestjs/config';
import redisConfig from '../../config/redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;

  constructor(
    @Inject(redisConfig.KEY)
    private redisConfiguration: ConfigType<typeof redisConfig>,
  ) {}

  async onModuleInit() {
    try {
      this.redisClient = new Redis({
        host: this.redisConfiguration.host,
        port: this.redisConfiguration.port,
        lazyConnect: true,
      });
      await this.redisClient.connect();
      console.log('RedisService (Caching) connected.');
    } catch (error) {
      console.error('Failed to connect to Redis in RedisService:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.status === 'ready') {
      await this.redisClient.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<string> {
    const val = JSON.stringify(value);
    if (ttl) {
      return this.redisClient.setex(key, ttl, val);
    }
    return this.redisClient.set(key, val);
  }

  async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return this.redisClient.del(...key);
    }
    return this.redisClient.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    const stream = this.redisClient.scanStream({
      match: pattern,
      count: 100,
    });

    stream.on('data', (keys: string[]) => {
      if (keys.length > 0) {
        this.redisClient.del(...keys);
      }
    });

    return new Promise((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  async getOrSet<T>(
    key: string,
    ttl: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cachedData = await this.get<T>(key);
    if (cachedData !== null) {
      return cachedData;
    }

    const freshData = await factory();
    await this.set(key, freshData, ttl);
    return freshData;
  }

  async publish(channel: string, message: any): Promise<number> {
    const payload =
      typeof message === 'string' ? message : JSON.stringify(message);
    return await this.redisClient.publish(channel, payload);
  }

  async sadd(key: string, ...members: (string | number)[]): Promise<number> {
    return await this.redisClient.sadd(key, ...members);
  }

  async srem(key: string, ...members: (string | number)[]): Promise<number> {
    return await this.redisClient.srem(key, ...members);
  }

  async sismember(key: string, member: string | number): Promise<boolean> {
    const result = await this.redisClient.sismember(key, member);
    return result === 1;
  }

  get client(): Redis {
    return this.redisClient;
  }
}
