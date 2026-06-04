import { CommentRepository } from '../../modules/comment/comment.repository';
import { Mock } from '../types';
import { createQueryRunnerMock } from './mysql.service.mock';

export const createCommentRepositoryMock = (): Mock<CommentRepository> => ({
  insertComment: jest.fn(),
  insertReply: jest.fn(),
  incrementCommentCount: jest.fn(),
  decrementCommentCount: jest.fn(),
  softDeleteComment: jest.fn(),
  softDeleteReply: jest.fn(),
  findCommentsByPost: jest.fn(),
  findRepliesByComment: jest.fn(),
  checkDeletionPermission: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
});
