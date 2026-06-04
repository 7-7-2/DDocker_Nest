import { FollowRepository } from '../../modules/follow/follow.repository';
import { Mock } from '../types';
import { createQueryRunnerMock } from './mysql.service.mock';

export const createFollowRepositoryMock = (): Mock<FollowRepository> => ({
  follow: jest.fn(),
  updateMutualStatus: jest.fn(),
  unfollow: jest.fn(),
  isMutual: jest.fn(),
  isFollowing: jest.fn(),
  areMutual: jest.fn(),
  findFollowList: jest.fn(),
  incrementFollowCounts: jest.fn(),
  decrementFollowCounts: jest.fn(),
  getUsernameById: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
});
