import { TransactionManager } from '../../common/database/transaction.manager';
import { Mock } from '../types';

export const createTransactionManagerMock = (): Mock<TransactionManager> => ({
  run: jest.fn().mockImplementation((work, options) => {
    // By default, just execute the work function with a mock queryRunner
    return work({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    });
  }),
});
