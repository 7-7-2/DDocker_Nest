import { QueryRunner } from 'typeorm';
import { MysqlService } from '../../providers/mysql/mysql.service';
import { Mock } from '../types';

export const createQueryRunnerMock = (): jest.Mocked<QueryRunner> =>
  ({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
  }) as unknown as jest.Mocked<QueryRunner>;

export const createMysqlServiceMock = (): Mock<MysqlService> => ({
  query: jest.fn(),
  execute: jest.fn(),
  getQueryRunner: jest.fn(() => createQueryRunnerMock()),
  isResultSetHeader: jest.fn(
    (result: any) =>
      result !== null &&
      typeof result === 'object' &&
      'affectedRows' in result &&
      'insertId' in result,
  ),
});
