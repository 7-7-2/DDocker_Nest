import { ConfigService } from '@nestjs/config';
import { Mock } from '../types';

export const createConfigServiceMock = (): Mock<ConfigService> => {
  const config: Record<string, string | number | boolean | object> = {
    ACCESS_TOKEN_SECRET: 'test-access-secret',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret',
    GOOGLE_CLIENT_ID: 'test-google-id',
    GOOGLE_CALLBACK_URL: 'http://localhost:4000/api/auth/google/callback',
    KAKAO_CLIENT_ID: 'test-kakao-id',
    KAKAO_CALLBACK_URL: 'http://localhost:4000/api/auth/kakao/callback',
    server: {
      frontendUrl: 'http://localhost:3000',
    },
  };

  return {
    get: jest.fn((key: string) => config[key]),
    getOrThrow: jest.fn((key: string) => {
      const val = config[key];
      if (!val) throw new Error(`Config key "${key}" not found`);
      return val;
    }),
  };
};
