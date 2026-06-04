import { Test, TestingModule } from '@nestjs/testing';
import { FollowService } from './follow.service';
import { FollowRepository } from './follow.repository';
import { NotificationService } from '../notification/notification.service';
import { RedisService } from '../../providers/redis/redis.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { createFollowRepositoryMock } from '../../test-utils/mocks/follow.repository.mock';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Mock } from '../../test-utils/types';
import { QueryRunner } from 'typeorm';

describe('FollowService', () => {
  let service: FollowService;
  let followRepository: Mock<FollowRepository>;
  let notificationService: Mock<NotificationService>;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    const repoMock = createFollowRepositoryMock();
    queryRunner = repoMock.getQueryRunner!() as jest.Mocked<QueryRunner>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowService,
        {
          provide: FollowRepository,
          useValue: repoMock,
        },
        {
          provide: NotificationService,
          useValue: {
            pushNotification: jest.fn(),
          },
        },
        { provide: RedisService, useValue: createRedisServiceMock() },
      ],
    }).compile();

    service = module.get<FollowService>(FollowService);
    followRepository = module.get(FollowRepository);
    notificationService = module.get(NotificationService);

    followRepository.getQueryRunner!.mockReturnValue(queryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('follow', () => {
    it('should throw BadRequestException if following self', async () => {
      await expect(service.follow('user-1', 'nick', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if already following', async () => {
      jest.spyOn(service, 'isFollowing').mockResolvedValue(true);
      await expect(service.follow('user-1', 'nick', 'user-2')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should follow and update mutual status if applicable', async () => {
      jest
        .spyOn(service, 'isFollowing')
        .mockResolvedValueOnce(false) // alreadyFollowing check
        .mockResolvedValueOnce(true); // isNowMutual check

      await service.follow('user-1', 'nick-1', 'user-2');

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(followRepository.follow).toHaveBeenCalledWith(
        'user-1',
        'user-2',
        true,
        queryRunner,
      );
      expect(followRepository.updateMutualStatus).toHaveBeenCalledWith(
        'user-2',
        'user-1',
        true,
        queryRunner,
      );
      expect(followRepository.incrementFollowCounts).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(notificationService.pushNotification).toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('should throw NotFoundException if not following', async () => {
      jest.spyOn(service, 'isFollowing').mockResolvedValue(false);
      await expect(service.unfollow('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should unfollow and update mutual status if was mutual', async () => {
      jest.spyOn(service, 'isFollowing').mockResolvedValue(true);
      followRepository.isMutual!.mockResolvedValue(true);

      await service.unfollow('user-1', 'user-2');

      expect(followRepository.unfollow).toHaveBeenCalled();
      expect(followRepository.updateMutualStatus).toHaveBeenCalledWith(
        'user-2',
        'user-1',
        false,
        queryRunner,
      );
      expect(followRepository.decrementFollowCounts).toHaveBeenCalled();
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });
});
