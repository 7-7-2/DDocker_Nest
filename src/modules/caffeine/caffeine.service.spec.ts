import { Test, TestingModule } from '@nestjs/testing';
import { CaffeineService } from './caffeine.service';
import { CaffeineRepository } from './caffeine.repository';
import { BrandService } from '../brand/brand.service';
import { RedisService } from '../../providers/redis/redis.service';
import { PostService } from '../post/post.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { createCaffeineRepositoryMock } from '../../test-utils/mocks/caffeine.repository.mock';
import { createCaffeineIntakeFixture } from '../../test-utils/fixtures/caffeine.fixture';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { CreateCaffeineDto } from './dto/create-caffeine.dto';
import { Mock } from '../../test-utils/types';

describe('CaffeineService', () => {
  let service: CaffeineService;
  let caffeineRepository: Mock<CaffeineRepository>;
  let brandService: Mock<BrandService>;
  let postService: Mock<PostService>;
  let queryRunner: jest.Mocked<QueryRunner>;

  beforeEach(async () => {
    const repoMock = createCaffeineRepositoryMock();
    queryRunner = repoMock.getQueryRunner!() as jest.Mocked<QueryRunner>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaffeineService,
        {
          provide: CaffeineRepository,
          useValue: repoMock,
        },
        {
          provide: BrandService,
          useValue: {
            resolveBrandId: jest.fn(),
            resolveBrandName: jest.fn(),
          },
        },
        { provide: RedisService, useValue: createRedisServiceMock() },
        {
          provide: PostService,
          useValue: {
            getPostByIntakeId: jest.fn(),
            deletePost: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CaffeineService>(CaffeineService);
    caffeineRepository = module.get(CaffeineRepository);
    brandService = module.get(BrandService);
    postService = module.get(PostService);

    caffeineRepository.getQueryRunner!.mockReturnValue(queryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logIntake', () => {
    const dto: CreateCaffeineDto = {
      brandId: 'Starbucks',
      caffeine: 200,
      productName: 'Latte',
      size: 'Grande',
    };

    it('should throw BadRequestException if brand not resolved', async () => {
      brandService.resolveBrandId!.mockResolvedValue(null);
      await expect(service.logIntake('user-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log intake and update stats successfully', async () => {
      brandService.resolveBrandId!.mockResolvedValue(1);
      caffeineRepository.insertIntake!.mockResolvedValue(123);

      const result = await service.logIntake('user-1', dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(caffeineRepository.insertIntake).toHaveBeenCalled();
      expect(caffeineRepository.updateUserStatsSum).toHaveBeenCalledWith(
        'user-1',
        200,
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(result).toBe(123);
    });
  });

  describe('deleteIntake', () => {
    it('should throw NotFoundException if intake does not exist', async () => {
      caffeineRepository.findById!.mockResolvedValue(null);
      await expect(service.deleteIntake('user-1', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw UnauthorizedException if user does not own intake', async () => {
      caffeineRepository.findById!.mockResolvedValue({
        user_id: 'other-user',
        caffeine: 0,
        brand_id: 0,
        created_at: new Date(),
      });
      await expect(service.deleteIntake('user-1', 1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should delegate to postService if associated post exists', async () => {
      const intake = createCaffeineIntakeFixture({ user_id: 'user-1' });
      caffeineRepository.findById!.mockResolvedValue(intake);
      postService.getPostByIntakeId!.mockResolvedValue('post-123');

      await service.deleteIntake('user-1', 1);

      expect(postService.deletePost).toHaveBeenCalledWith('user-1', 'post-123');
      expect(caffeineRepository.softDeleteIntake).not.toHaveBeenCalled();
    });

    it('should delete standalone intake successfully', async () => {
      const intake = createCaffeineIntakeFixture({
        user_id: 'user-1',
        caffeine: 150,
      });
      caffeineRepository.findById!.mockResolvedValue(intake);
      postService.getPostByIntakeId!.mockResolvedValue(null);

      await service.deleteIntake('user-1', 1);

      expect(caffeineRepository.softDeleteIntake).toHaveBeenCalledWith(
        1,
        queryRunner,
      );
      expect(caffeineRepository.updateUserStatsSum).toHaveBeenCalledWith(
        'user-1',
        -150,
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('getTodayConsumption', () => {
    it('should return 0s if no consumption found', async () => {
      caffeineRepository.findTodayConsumption!.mockResolvedValue(null);
      const result = await service.getTodayConsumption('user-1');
      expect(result.todayCaffeine).toBe(0);
      expect(result.items).toEqual([]);
    });

    it('should return aggregated consumption', async () => {
      caffeineRepository.findTodayConsumption!.mockResolvedValue({
        caffeine_sum: 300,
        cup_count: 2,
        items: [
          { brandName: 'Starbucks', caffeine: 150 },
          { brandName: 'Mega', caffeine: 150 },
        ],
      });

      const result = await service.getTodayConsumption('user-1');
      expect(result.todayCaffeine).toBe(300);
      expect(result.items).toHaveLength(2);
    });
  });
});
