import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../modules/user/user.service';
import { RedisService } from '../providers/redis/redis.service';
import { createJwtServiceMock } from '../test-utils/mocks/jwt.service.mock';
import { createConfigServiceMock } from '../test-utils/mocks/config.service.mock';
import { createRedisServiceMock } from '../test-utils/mocks/redis.service.mock';
import { createUserServiceMock } from '../test-utils/mocks/user.service.mock';
import { createUserRowFixture } from '../test-utils/fixtures/user.fixture';
import { UnauthorizedException, HttpStatus } from '@nestjs/common';
import { OAuthUser } from './interfaces/oauth-user.interface';
import { Mock } from '../test-utils/types';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: Mock<JwtService>;
  let userService: Mock<UserService>;
  let redisService: Mock<RedisService>;

  const mockUser = createUserRowFixture();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: createJwtServiceMock() },
        { provide: ConfigService, useValue: createConfigServiceMock() },
        { provide: UserService, useValue: createUserServiceMock() },
        { provide: RedisService, useValue: createRedisServiceMock() },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
    userService = module.get(UserService);
    redisService = module.get(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateToken', () => {
    it('should verify and return payload', async () => {
      const payload = { sub: 'test-user-uuid' };
      jwtService.verifyAsync!.mockResolvedValue(payload);

      const result = await service.validateToken('valid-token');

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
        secret: 'test-access-secret',
      });
      expect(result).toEqual(payload);
    });
  });

  describe('login', () => {
    it('should sign tokens and store refresh token in redis', async () => {
      jwtService
        .signAsync!.mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login(mockUser);

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(redisService.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.public_id}`,
        'refresh-token',
        7 * 24 * 60 * 60,
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException if tokens do not match', async () => {
      redisService.get!.mockResolvedValue('different-token');

      await expect(service.refresh(mockUser, 'current-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return new tokens if valid (Deep Configuration)', async () => {
      redisService.get!.mockResolvedValue('valid-refresh-token');
      jwtService
        .signAsync!.mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
      redisService.set!.mockResolvedValue('OK');

      const result = await service.refresh(mockUser, 'valid-refresh-token');

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
      expect(result.accessToken).toBe('new-access-token');
      expect(redisService.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.public_id}`,
        'new-refresh-token',
        7 * 24 * 60 * 60,
      );
    });
  });

  describe('processOAuthLogin', () => {
    const oauthUser: OAuthUser = {
      email: 'test@example.com',
      provider: 'google',
    };

    it('should login if user exists (Flow A - Deep Configuration)', async () => {
      userService.findByEmailAndProvider!.mockResolvedValue(mockUser);
      jwtService
        .signAsync!.mockResolvedValueOnce('acc')
        .mockResolvedValueOnce('ref');

      const result = await service.processOAuthLogin(oauthUser);

      expect(result.status).toBe(HttpStatus.OK);
      expect(result.accessToken).toBe('acc');
      expect(redisService.set).toHaveBeenCalled();
    });

    it('should return handover token if user does not exist (Flow B)', async () => {
      userService.findByEmailAndProvider!.mockResolvedValue(null);
      redisService.set!.mockResolvedValue('OK');

      const result = await service.processOAuthLogin(oauthUser);

      expect(result.status).toBe(HttpStatus.CREATED);
      expect(result.socialToken).toBe('test-nanoid');
      expect(redisService.set).toHaveBeenCalledWith(
        'auth_handover:test-nanoid',
        oauthUser,
        900,
      );
    });
  });
});
