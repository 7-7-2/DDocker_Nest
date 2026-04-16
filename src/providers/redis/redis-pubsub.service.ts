import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigType } from '@nestjs/config';
import redisConfig from '../../config/redis.config';
import { Observable, Subject, filter, map } from 'rxjs';

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis;
  private readonly messageSubject = new Subject<{
    channel: string;
    message: string;
  }>();
  private readonly subscribedChannels = new Set<string>();

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

      this.redisClient.on('message', (channel, message) => {
        this.messageSubject.next({ channel, message });
      });

      this.redisClient.on('error', (err) => {
        console.error('RedisPubSubService Error:', err);
      });

      await this.redisClient.connect();
      console.log('RedisPubSubService (Dispatcher) connected.');
    } catch (error) {
      console.error('Failed to connect to Redis in RedisPubSubService:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  fromChannel(channel: string): Observable<any> {
    if (!this.subscribedChannels.has(channel)) {
      this.redisClient
        .subscribe(channel)
        .then(() => {
          this.subscribedChannels.add(channel);
        })
        .catch((err) => {
          console.error(
            `[RedisPubSubService] Failed to subscribe to ${channel}:`,
            err,
          );
        });
    }

    return this.messageSubject.asObservable().pipe(
      filter((data) => data.channel === channel),
      map((data) => ({ data: JSON.parse(data.message) })),
    );
  }
}
