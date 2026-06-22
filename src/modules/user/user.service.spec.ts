import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { RedisService } from '../../providers/redis/redis.service';
import { BrandService } from '../brand/brand.service';
import { AuthService } from '../../auth/auth.service';
import { createRedisServiceMock } from '../../test-utils/mocks/redis.service.mock';
import { createUserRepositoryMock } from '../../test-utils/mocks/user.repository.mock';
import { createUserRowFixture } from '../../test-utils/fixtures/user.fixture';
import { TransactionManager } from '../../common/database/transaction.manager';
import { createTransactionManagerMock } from '../../test-utils/mocks/transaction.manager.mock';
import {
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
  HttpException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { Mock } from '../../test-utils/types';
import { QueryRunner } from 'typeorm';

describe('UserService', () => {
  let service: UserService;
  let userRepository: Mock<UserRepository>;
  let redisService: Mock<RedisService>;
  let brandService: Mock<BrandService>;
  let authService: Mock<AuthService>;
  let queryRunner: jest.Mocked<QueryRunner>;
  let txManager: Mock<TransactionManager>;

  const mockUser = createUserRowFixture();

  beforeEach(async () => {
    const repoMock = createUserRepositoryMock();
    queryRunner = repoMock.getQueryRunner!() as jest.Mocked<QueryRunner>;
    txManager = createTransactionManagerMock();

    txManager.run!.mockImplementation(async (work, options) => {
      await queryRunner.startTransaction();
      try {
        const result = await work(queryRunner);
        await queryRunner.commitTransaction();
        return result;
      } catch (error) {
        await queryRunner.rollbackTransaction();
        if (error instanceof HttpException) {
          throw error;
        }
        throw new InternalServerErrorException(options?.message);
      } finally {
        await queryRunner.release();
      }
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useValue: repoMock,
        },
        {
          provide: TransactionManager,
          useValue: txManager,
        },
        { provide: RedisService, useValue: createRedisServiceMock() },
        {
          provide: BrandService,
          useValue: {
            resolveBrandId: jest.fn(),
            resolveBrandName: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(UserRepository);
    redisService = module.get(RedisService);
    brandService = module.get(BrandService);
    authService = module.get(AuthService);

    userRepository.getQueryRunner!.mockReturnValue(queryRunner);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('setUserInit', () => {
    const dto: CreateUserDto = {
      socialToken: 'handover-123',
      userId: 'new-user-id',
      nickname: 'NewUser',
      brand: 'Starbucks',
      profileUrl: 'http://img.com',
      aboutMe: 'Hello',
    };

    it('should throw UnauthorizedException if handover token is invalid', async () => {
      redisService.get!.mockResolvedValue(null);
      await expect(service.setUserInit(dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException if brand name is invalid', async () => {
      redisService.get!.mockResolvedValue({
        email: 'test@test.com',
        provider: 'google',
      });
      brandService.resolveBrandId!.mockResolvedValue(null);
      await expect(service.setUserInit(dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should initialize user successfully and commit transaction', async () => {
      const oauthUser = { email: 'test@test.com', provider: 'google' };
      redisService.get!.mockResolvedValue(oauthUser);
      brandService.resolveBrandId!.mockResolvedValue(10);
      userRepository.findByPublicId!.mockResolvedValue(mockUser);
      authService.login!.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
      });

      const result = await service.setUserInit(dto);

      expect(queryRunner.startTransaction).toHaveBeenCalled();
      expect(userRepository.insertUser).toHaveBeenCalledWith(
        expect.objectContaining({
          public_id: dto.userId,
          useremail: oauthUser.email,
          nickname: dto.nickname,
          fav_brand_id: 10,
        }),
        queryRunner,
      );
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(redisService.del).toHaveBeenCalledWith(
        `auth_handover:${dto.socialToken}`,
      );
      expect(result.accessToken).toBe('Bearer at');
    });

    it('should rollback transaction on error', async () => {
      redisService.get!.mockResolvedValue({
        email: 'test@test.com',
        provider: 'google',
      });
      brandService.resolveBrandId!.mockResolvedValue(10);
      userRepository.insertUser!.mockRejectedValue(new Error('DB Error'));

      await expect(service.setUserInit(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('getUserInfo', () => {
    it('should return user info from repository and cache it', async () => {
      const userWithStats = { ...mockUser, sum: 500 };
      userRepository.findUserWithStats!.mockResolvedValue(userWithStats);
      brandService.resolveBrandName!.mockResolvedValue('Starbucks');

      const result = await service.getUserInfo('user-id');

      expect(result.nickname).toBe(mockUser.nickname);
      expect(result.sum).toBe(500);
      expect(result.brand).toBe('Starbucks');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findUserWithStats!.mockResolvedValue(null);
      await expect(service.getUserInfo('ghost')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('patchUserProfile', () => {
    it('should resolve brand id and update profile', async () => {
      brandService.resolveBrandId!.mockResolvedValue(20);

      await service.patchUserProfile('user-id', {
        nickname: 'Updated',
        brand: 'Mega',
      });

      expect(userRepository.patchUserProfile).toHaveBeenCalledWith('user-id', {
        nickname: 'Updated',
        fav_brand_id: 20,
      });
      expect(redisService.del).toHaveBeenCalledWith('user:profile:user-id');
    });
  });
});
