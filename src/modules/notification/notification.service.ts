import { Injectable } from '@nestjs/common';
import { RedisService } from '../../providers/redis/redis.service';
import { NotificationPayloadDto } from './dto/notification-payload.dto';
import { Observable, map, of, merge, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable()
export class NotificationService {
  private readonly REDIS_PREFIX = 'notifications:';

  constructor(private readonly redisService: RedisService) {}

  async pushNotification(
    receiverId: string,
    payload: NotificationPayloadDto,
  ): Promise<void> {
    const key = `${this.REDIS_PREFIX}${receiverId}`;
    const message = JSON.stringify(payload);

    const subscribers = await this.redisService.client.pubsub('NUMSUB', key);
    const isConnected = (subscribers[1] as number) > 0;

    if (isConnected) {
      await this.redisService.client.publish(key, message);
    } else {
      await this.redisService.client.lpush(key, message);
    }
  }

  getNotificationStream(userId: string): Observable<any> {
    const key = `${this.REDIS_PREFIX}${userId}`;

    const missed$ = from(this.retrieveAndClearNotifications(userId)).pipe(
      switchMap((missedArray) => of(...missedArray)),
      map((data) => ({ data })),
    );

    const live$ = this.redisService
      .fromChannel(key)
      .pipe(map((message) => ({ data: JSON.parse(message) as string })));

    return merge(missed$, live$);
  }

  private async retrieveAndClearNotifications(
    userId: string,
  ): Promise<NotificationPayloadDto[]> {
    const key = `${this.REDIS_PREFIX}${userId}`;
    const notifications = await this.redisService.client.lrange(key, 0, -1);

    if (notifications && notifications.length > 0) {
      await this.redisService.client.del(key);
      return notifications
        .map((n) => JSON.parse(n) as NotificationPayloadDto)
        .reverse();
    }

    return [];
  }
}
