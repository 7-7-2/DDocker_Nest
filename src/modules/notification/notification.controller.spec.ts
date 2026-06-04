import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { of } from 'rxjs';

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            getNotificationStream: jest.fn(),
            getHistory: jest.fn(),
            markAllAsRead: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('sse', () => {
    it('should call getNotificationStream', () => {
      service.getNotificationStream.mockReturnValue(of({} as MessageEvent));
      controller.sse('user-1');
      expect(service.getNotificationStream).toHaveBeenCalledWith('user-1');
    });
  });
});
