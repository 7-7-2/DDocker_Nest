import { UserService } from '../../modules/user/user.service';
import { Mock } from '../types';

export const createUserServiceMock = (): Mock<UserService> => ({
  findByEmailAndProvider: jest.fn(),
  findByPublicId: jest.fn(),
  getAuthUserByPublicId: jest.fn(),
  getUserInfo: jest.fn(),
  patchUserProfile: jest.fn(),
  deleteAccount: jest.fn(),
  checkUserNickname: jest.fn(),
  getUserFollowCounts: jest.fn(),
  updateLastNotiRead: jest.fn(),
  getLastNotiRead: jest.fn(),
  setUserInit: jest.fn(),
});
