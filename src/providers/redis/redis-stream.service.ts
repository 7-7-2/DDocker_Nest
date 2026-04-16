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
export class RedisStreamService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;
  private blockingClient: Redis;

  constructor(
    @Inject(redisConfig.KEY)
    private redisConfiguration: ConfigType<typeof redisConfig>,
  ) {}

  async onModuleInit() {
    try {
      const redisOptions = {
        host: this.redisConfiguration.host,
        port: this.redisConfiguration.port,
        lazyConnect: true,
      };

      this.redisClient = new Redis(redisOptions);
      this.blockingClient = new Redis(redisOptions);

      await Promise.all([
        this.redisClient.connect(),
        this.blockingClient.connect(),
      ]);
      console.log('RedisStreamService (Broker) connected.');
    } catch (error) {
      console.error('Failed to connect to Redis in RedisStreamService:', error);
    }
  }

  async onModuleDestroy() {
    const quitPromises: Promise<string | void>[] = [];
    if (this.redisClient && this.redisClient.status === 'ready') {
      quitPromises.push(this.redisClient.quit());
    }
    if (this.blockingClient && this.blockingClient.status === 'ready') {
      quitPromises.push(this.blockingClient.quit());
    }
    if (quitPromises.length > 0) {
      await Promise.all(quitPromises);
    }
  }

  async xadd(
    stream: string,
    id: string,
    fields: Record<string, any>,
    maxlen?: number,
  ): Promise<string> {
    const fieldValues: (string | number)[] = [];
    for (const [key, value] of Object.entries(fields)) {
      fieldValues.push(
        key,
        typeof value === 'object'
          ? JSON.stringify(value)
          : (value as string | number),
      );
    }

    if (maxlen) {
      return (
        (await this.redisClient.xadd(
          stream,
          'MAXLEN',
          '~',
          maxlen,
          id,
          ...fieldValues,
        )) || ''
      );
    }
    return (await this.redisClient.xadd(stream, id, ...fieldValues)) || '';
  }

  async xgroup(
    command: 'CREATE' | 'DESTROY' | 'SETID',
    stream: string,
    group: string,
    id: string = '$',
  ): Promise<string> {
    try {
      let result: unknown;
      if (command === 'CREATE') {
        result = await this.redisClient.xgroup(
          'CREATE',
          stream,
          group,
          id,
          'MKSTREAM',
        );
      } else if (command === 'DESTROY') {
        result = await this.redisClient.xgroup('DESTROY', stream, group);
      } else {
        result = await this.redisClient.xgroup('SETID', stream, group, id);
      }
      return String(result);
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        return 'OK';
      }
      throw error;
    }
  }

  async xreadgroup(
    group: string,
    consumer: string,
    stream: string,
    count: number = 1,
    block: number = 2000,
  ): Promise<any> {
    return await this.blockingClient.xreadgroup(
      'GROUP',
      group,
      consumer,
      'COUNT',
      count,
      'BLOCK',
      block,
      'STREAMS',
      stream,
      '>',
    );
  }

  async xack(stream: string, group: string, ...ids: string[]): Promise<number> {
    return await this.redisClient.xack(stream, group, ...ids);
  }

  async xpending(
    stream: string,
    group: string,
    start: string = '-',
    end: string = '+',
    count: number = 10,
  ): Promise<any[]> {
    return await this.redisClient.xpending(stream, group, start, end, count);
  }

  async xclaim(
    stream: string,
    group: string,
    consumer: string,
    minIdleTime: number,
    ...ids: string[]
  ): Promise<any[]> {
    return await this.redisClient.xclaim(
      stream,
      group,
      consumer,
      minIdleTime,
      ...ids,
    );
  }

  get client(): Redis {
    return this.redisClient;
  }
}
