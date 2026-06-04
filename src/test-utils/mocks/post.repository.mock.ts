import { PostRepository } from '../../modules/post/post.repository';
import { Mock } from '../types';
import { createQueryRunnerMock } from './mysql.service.mock';

export const createPostRepositoryMock = (): Mock<PostRepository> => ({
  findPostDetail: jest.fn(),
  findFollowingPosts: jest.fn(),
  findPostStats: jest.fn(),
  insertPost: jest.fn(),
  insertPostStats: jest.fn(),
  patchPost: jest.fn(),
  findUserPosts: jest.fn(),
  findUserPostsDetailed: jest.fn(),
  findUserPostCount: jest.fn(),
  updateUserStatsPostCount: jest.fn(),
  softDeletePost: jest.fn(),
  findPostByIntakeId: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
});
