import { JwtService } from '@nestjs/jwt';
import { Mock } from '../types';

export const createJwtServiceMock = (): Mock<JwtService> => ({
  signAsync: jest.fn().mockResolvedValue('test-token'),
  verifyAsync: jest.fn().mockResolvedValue({ sub: 'test-user-uuid' }),
});
