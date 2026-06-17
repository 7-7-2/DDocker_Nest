import { Test, TestingModule } from '@nestjs/testing';
import { InteractionListener } from './interaction.listener';
import { RedisService } from '../../providers/redis/redis.service';
import { NotificationService } from '../notification/notification.service';
import { PostLikedEvent } from '../../common/events/interaction.events';
import { REDIS_KEYS } from '../../common/constants/redis-keys';

describe('InteractionListener', () => {
  let listener: InteractionListener;
  let redisService: jest.Mocked<RedisService>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionListener,
        {
          provide: RedisService,
          useValue: {
            del: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            pushNotification: jest.fn(),
          },
        },
      ],
    }).compile();

    listener = module.get<InteractionListener>(InteractionListener);
    redisService = module.get(RedisService);
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  describe('handlePostLiked', () => {
    it('should invalidate cache and send notification', async () => {
      const event = new PostLikedEvent('user-1', 'liker', 'post-1', 'owner-1');
      await listener.handlePostLiked(event);

      expect(redisService.del).toHaveBeenCalledWith(
        REDIS_KEYS.POST.STATS('post-1'),
      );
      expect(notificationService.pushNotification).toHaveBeenCalledWith(
        'owner-1',
        expect.objectContaining({
          type: 'like',
          senderId: 'user-1',
        }),
      );
    });

    it('should not send notification if user likes their own post', async () => {
      const event = new PostLikedEvent('owner-1', 'liker', 'post-1', 'owner-1');
      await listener.handlePostLiked(event);

      expect(redisService.del).toHaveBeenCalled();
      expect(notificationService.pushNotification).not.toHaveBeenCalled();
    });
  });
});
