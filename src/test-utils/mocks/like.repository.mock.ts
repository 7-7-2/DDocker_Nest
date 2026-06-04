import { LikeRepository } from '../../modules/like/like.repository';
import { Mock } from '../types';
import { createQueryRunnerMock } from './mysql.service.mock';

export const createLikeRepositoryMock = (): Mock<LikeRepository> => ({
  insertLike: jest.fn(),
  deleteLike: jest.fn(),
  findLike: jest.fn(),
  updateLikeCount: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
});
