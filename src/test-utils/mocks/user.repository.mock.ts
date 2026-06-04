import { UserRepository } from '../../modules/user/user.repository';
import { Mock } from '../types';
import { createQueryRunnerMock } from './mysql.service.mock';

export const createUserRepositoryMock = (): Mock<UserRepository> => ({
  insertUser: jest.fn(),
  insertInitStats: jest.fn(),
  updateLastNotiRead: jest.fn(),
  findLastNotiRead: jest.fn(),
  findAuthUserByPublicId: jest.fn(),
  findByPublicId: jest.fn(),
  findByEmailAndProvider: jest.fn(),
  findUserWithStats: jest.fn(),
  findUserFollowCounts: jest.fn(),
  patchUserProfile: jest.fn(),
  deleteAccount: jest.fn(),
  checkNickname: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
});
