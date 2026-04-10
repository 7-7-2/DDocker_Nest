import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigType } from '@nestjs/config';
import redisConfig from '../../config/redis.config';
import { Observable } from 'rxjs';

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

  duplicate(): Redis {
    return this.redisClient.duplicate();
  }

  fromChannel(channel: string): Observable<string> {
    return new Observable<string>((subscriber) => {
      const redisSubscriber = this.duplicate();

      redisSubscriber
        .subscribe(channel)
        .then(() => {
          redisSubscriber.on('message', (chan, message) => {
            if (chan === channel) {
              subscriber.next(message);
            }
          });
        })
        .catch((err) => {
          subscriber.error(err);
        });

      redisSubscriber.on('error', (err) => {
        subscriber.error(err);
      });

      return () => {
        redisSubscriber.unsubscribe(channel).catch(() => {});
        redisSubscriber.quit().catch(() => {});
      };
    });
  }
}
