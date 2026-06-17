import { Test, TestingModule } from '@nestjs/testing';
import { LikeService } from './like.service';
import { LikeRepository } from './like.repository';
import { RedisService } from '../../providers/redis/redis.service';
import { PostRepository } from '../post/post.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { createLikeRepositoryMock } from '../../test-utils/mocks/like.repository.mock';
import { createPostRepositoryMock } from '../../test-utils/mocks/post.repository.mock';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Mock } from '../../test-utils/types';
import { QueryRunner } from 'typeorm';

describe('LikeService', () => {
  let service: LikeService;
  let likeRepository: Mock<LikeRepository>;
  let redisService: Mock<RedisService>;
  let postRepository: Mock<PostRepository>;
  let eventEmitter: Mock<EventEmitter2>;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    const repoMock = createLikeRepositoryMock();
    queryRunner = repoMock.getQueryRunner!() as jest.Mocked<QueryRunner>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LikeService,
        {
          provide: LikeRepository,
          useValue: repoMock,
        },
        { provide: RedisService, useValue: createRedisServiceMock() },
        {
          provide: PostRepository,
          useValue: createPostRepositoryMock(),
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LikeService>(LikeService);
    likeRepository = module.get(LikeRepository);
    redisService = module.get(RedisService);
    postRepository = module.get(PostRepository);
    eventEmitter = module.get(EventEmitter2);

    likeRepository.getQueryRunner!.mockReturnValue(queryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('likePost', () => {
    it('should throw ConflictException if already liked', async () => {
      jest.spyOn(service, 'isLiked').mockResolvedValue(true);
      await expect(
        service.likePost('user-1', 'nick', 'post-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if post not found', async () => {
      jest.spyOn(service, 'isLiked').mockResolvedValue(false);
      postRepository.findPostDetail!.mockResolvedValue(null as any);
      await expect(
        service.likePost('user-1', 'nick', 'post-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should like post and commit transaction', async () => {
      jest.spyOn(service, 'isLiked').mockResolvedValue(false);
      postRepository.findPostDetail!.mockResolvedValue({
        user_id: 'post-owner',
      } as any);

      await service.likePost('user-1', 'nick-1', 'post-1');

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(likeRepository.insertLike).toHaveBeenCalledWith(
        'user-1',
        'post-1',
        queryRunner,
      );
      expect(likeRepository.updateLikeCount).toHaveBeenCalledWith(
        'post-1',
        1,
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.sadd).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'post.liked',
        expect.anything(),
      );
    });
  });

  describe('unlikePost', () => {
    it('should throw NotFoundException if not liked', async () => {
      jest.spyOn(service, 'isLiked').mockResolvedValue(false);
      await expect(service.unlikePost('user-1', 'post-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should unlike post and commit transaction', async () => {
      jest.spyOn(service, 'isLiked').mockResolvedValue(true);

      await service.unlikePost('user-1', 'post-1');

      expect(likeRepository.deleteLike).toHaveBeenCalled();
      expect(likeRepository.updateLikeCount).toHaveBeenCalledWith(
        'post-1',
        -1,
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.srem).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'post.unliked',
        expect.anything(),
      );
    });
  });
});
