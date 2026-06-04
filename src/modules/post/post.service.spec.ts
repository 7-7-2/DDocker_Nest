import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { PostRepository } from './post.repository';
import { RedisService } from '../../providers/redis/redis.service';
import { CaffeineService } from '../caffeine/caffeine.service';
import { CaffeineRepository } from '../caffeine/caffeine.repository';
import { BrandService } from '../brand/brand.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { createPostRepositoryMock } from '../../test-utils/mocks/post.repository.mock';
import { createCaffeineRepositoryMock } from '../../test-utils/mocks/caffeine.repository.mock';
import { createPostDetailRowFixture } from '../../test-utils/fixtures/post.fixture';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Mock } from '../../test-utils/types';
import { QueryRunner } from 'typeorm';
import { CreatePostDto } from './dto/create-post.dto';

describe('PostService', () => {
  let service: PostService;
  let postRepository: Mock<PostRepository>;
  let redisService: Mock<RedisService>;
  let caffeineService: Mock<CaffeineService>;
  let caffeineRepository: Mock<CaffeineRepository>;
  let brandService: Mock<BrandService>;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    const repoMock = createPostRepositoryMock();
    queryRunner = repoMock.getQueryRunner!() as jest.Mocked<QueryRunner>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: PostRepository,
          useValue: repoMock,
        },
        { provide: RedisService, useValue: createRedisServiceMock() },
        {
          provide: CaffeineService,
          useValue: {
            logIntake: jest.fn(),
            updateBrandRanking: jest.fn(),
          },
        },
        {
          provide: CaffeineRepository,
          useValue: createCaffeineRepositoryMock(),
        },
        {
          provide: BrandService,
          useValue: {
            resolveBrandId: jest.fn(),
            resolveBrandName: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    postRepository = module.get(PostRepository);
    redisService = module.get(RedisService);
    caffeineService = module.get(CaffeineService);
    caffeineRepository = module.get(CaffeineRepository);
    brandService = module.get(BrandService);

    postRepository.getQueryRunner!.mockReturnValue(queryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerPost', () => {
    const dto: CreatePostDto = {
      postId: 'post-123',
      brand: 'Starbucks',
      caffeine: 150,
      productName: 'Americano',
      size: 'Regular',
      visibility: 1,
    };

    it('should throw BadRequestException if brand not resolved', async () => {
      brandService.resolveBrandId!.mockResolvedValue(null);
      await expect(service.registerPost('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should register post and commit transaction', async () => {
      brandService.resolveBrandId!.mockResolvedValue(1);
      caffeineService.logIntake!.mockResolvedValue(100);

      await service.registerPost('user-1', dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(caffeineService.logIntake).toHaveBeenCalled();
      expect(postRepository.insertPost).toHaveBeenCalled();
      expect(postRepository.updateUserStatsPostCount).toHaveBeenCalledWith(
        'user-1',
        1,
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      brandService.resolveBrandId!.mockResolvedValue(1);
      caffeineService.logIntake!.mockRejectedValue(new Error('Log Error'));

      await expect(service.registerPost('user-1', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('deletePost', () => {
    it('should delete post and associated intake successfully', async () => {
      const postDetail = createPostDetailRowFixture({
        user_id: 'user-1',
        caffeine_intake_id: 100,
        caffeine: 150,
      });
      postRepository.findPostDetail!.mockResolvedValue(postDetail);

      await service.deletePost('user-1', 'post-123');

      expect(postRepository.softDeletePost).toHaveBeenCalledWith(
        'post-123',
        queryRunner,
      );
      expect(caffeineRepository.softDeleteIntake).toHaveBeenCalledWith(
        100,
        queryRunner,
      );
      expect(caffeineRepository.updateUserStatsSum).toHaveBeenCalledWith(
        'user-1',
        -150,
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(caffeineService.updateBrandRanking).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException if user does not own post', async () => {
      postRepository.findPostDetail!.mockResolvedValue({
        user_id: 'other-user',
      } as any);
      await expect(service.deletePost('user-1', 'post-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getPostDetail', () => {
    it('should return mapped post detail from cache/db', async () => {
      const postDetail = createPostDetailRowFixture();
      postRepository.findPostDetail!.mockResolvedValue(postDetail);
      postRepository.findPostStats!.mockResolvedValue({
        post_id: 'post-123',
        like_count: 5,
        comment_count: 3,
      });
      brandService.resolveBrandName!.mockResolvedValue('Starbucks');

      const result = await service.getPostDetail('post-123');

      expect(result.postId).toBe('post-123');
      expect(result.likeCount).toBe(5);
      expect(result.brand).toBe('Starbucks');
    });
  });
});
