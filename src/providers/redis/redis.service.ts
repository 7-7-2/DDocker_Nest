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
    console.log('Connecting to Redis...');
    try {
      this.redisClient = new Redis({
        host: this.redisConfiguration.host,
        port: this.redisConfiguration.port,
        lazyConnect: true,
      });

      await this.redisClient.connect();
      console.log('Redis connection established.');
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redisClient && this.redisClient.status === 'ready') {
      console.log('Disconnecting from Redis...');
      await this.redisClient.quit();
      console.log('Redis client disconnected.');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const data = await this.redisClient.get(key);
    return data ? (JSON.parse(data) as T) : null;
  }

  async set(key: string, value: any, ttl?: number): Promise<string> {
    if (ttl) {
      return this.redisClient.setex(key, ttl, JSON.stringify(value));
    }
    return this.redisClient.set(key, JSON.stringify(value));
  }

  async del(key: string | string[]): Promise<number> {
    if (Array.isArray(key)) {
      return this.redisClient.del(...key);
    }
    return this.redisClient.del(key);
  }

  get client(): Redis {
    return this.redisClient;
  }
}
